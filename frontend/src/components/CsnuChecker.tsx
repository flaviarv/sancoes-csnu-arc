import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Info,
  Type,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileCode,
  File as FileIcon,
  X,
  FileCheck
} from 'lucide-react'

export interface NameResult {
  name: string
  is_contained: boolean
  message: string
}

interface CheckResponse {
  results: NameResult[]
}

interface Props {
  onSearchComplete?: (results: NameResult[], namesText: string) => void
  isPaid: boolean
}

type InputMode = 'manual' | 'file'

export default function CsnuChecker({ onSearchComplete, isPaid }: Props) {
  const [inputMode, setInputMode] = useState<InputMode>('manual')
  const [input, setInput] = useState('')
  const [results, setResults] = useState<NameResult[]>([])
  const [loading, setLoading] = useState(false)
  const [parsingFile, setParsingFile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  // Estados de arquivo
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileNames, setFileNames] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const lineCount = input.split('\n').filter(l => l.trim()).length
  const activeNamesCount = inputMode === 'manual' ? lineCount : fileNames.length

  function normalizeClientText(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
  }

  // Parser para arquivos PDF
  async function parsePdf(file: File): Promise<string[]> {
    if (!(window as any).pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        script.onload = () => {
          const pdfjs = (window as any).pdfjsLib
          pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
          resolve()
        }
        script.onerror = () => reject(new Error('Não foi possível carregar a biblioteca de leitura de PDF.'))
        document.head.appendChild(script)
      })
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageStrings = textContent.items.map((item: any) => item.str)
      fullText += pageStrings.join('\n') + '\n'
    }

    return fullText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 2 && !/^\d+$/.test(line) && !line.toLowerCase().includes('página'))
  }

  // Parser para arquivos CSV
  function parseCsv(text: string): string[] {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return []

    const firstLine = lines[0]
    const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ','

    const rows = lines.map(line =>
      line.split(delimiter).map(cell => cell.replace(/^["']|["']$/g, '').trim())
    )

    // Tenta encontrar coluna com cabeçalho de nome
    const headerRow = rows[0].map(h => h.toLowerCase())
    const targetKeywords = ['nome', 'name', 'full_name', 'nome_completo', 'razao_social', 'entity', 'entidade']
    let nameColIndex = headerRow.findIndex(h => targetKeywords.some(kw => h.includes(kw)))

    if (nameColIndex !== -1 && rows.length > 1) {
      return rows.slice(1).map(r => r[nameColIndex]).filter(Boolean)
    }

    // Se não encontrou cabeçalho conhecido, usa a primeira coluna
    return rows.map(r => r[0]).filter(Boolean)
  }

  // Parser para arquivos JSON
  function parseJson(text: string): string[] {
    const parsed = JSON.parse(text)
    const names: string[] = []

    function extractFromArray(arr: any[]) {
      for (const item of arr) {
        if (typeof item === 'string' && item.trim()) {
          names.push(item.trim())
        } else if (item && typeof item === 'object') {
          const val = item.name || item.nome || item.fullName || item.full_name || item.razao_social || Object.values(item)[0]
          if (typeof val === 'string' && val.trim()) {
            names.push(val.trim())
          }
        }
      }
    }

    if (Array.isArray(parsed)) {
      extractFromArray(parsed)
    } else if (parsed && typeof parsed === 'object') {
      const arrayKey = Object.values(parsed).find(v => Array.isArray(v)) as any[] | undefined
      if (arrayKey) {
        extractFromArray(arrayKey)
      } else {
        for (const val of Object.values(parsed)) {
          if (typeof val === 'string' && val.trim()) names.push(val.trim())
        }
      }
    }

    return names
  }

  // Processa arquivo selecionado
  async function handleFileSelected(file: File) {
    setSelectedFile(file)
    setError(null)
    setParsingFile(true)
    setFileNames([])

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let names: string[] = []

      if (ext === 'txt') {
        const text = await file.text()
        names = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      } else if (ext === 'csv') {
        const text = await file.text()
        names = parseCsv(text)
      } else if (ext === 'json') {
        const text = await file.text()
        names = parseJson(text)
      } else if (ext === 'pdf') {
        names = await parsePdf(file)
      } else {
        throw new Error('Formato de arquivo não suportado. Use .txt, .csv, .json ou .pdf.')
      }

      // Remove duplicatas locais mantendo a ordem
      const uniqueNames = Array.from(new Set(names))

      if (uniqueNames.length === 0) {
        throw new Error('Nenhum nome válido foi encontrado dentro do arquivo.')
      }

      setFileNames(uniqueNames)
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar arquivo.')
      setSelectedFile(null)
      setFileNames([])
    } finally {
      setParsingFile(false)
    }
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0])
    }
  }

  function clearSelectedFile() {
    setSelectedFile(null)
    setFileNames([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Executa verificação contra o CSNU
  async function handleCheck() {
    const rawNames = inputMode === 'manual'
      ? input.split('\n').map(l => l.trim()).filter(Boolean)
      : fileNames

    if (rawNames.length === 0) return

    setLoading(true)
    setError(null)
    setResults([])

    const rawInputPayload = rawNames.join('\n')

    try {
      let data: CheckResponse | null = null

      try {
        const res = await fetch('/api/check-names', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_input: rawInputPayload }),
        })
        if (res.ok) {
          data = await res.json() as CheckResponse
        }
      } catch (err) {
        console.warn('API fetch failed, falling back to static list...', err)
      }

      // Fallback para lista estática JSON
      if (!data) {
        const jsonRes = await fetch('/sanctioned_names.json')
        if (!jsonRes.ok) throw new Error('Não foi possível carregar a lista de sanções.')
        const sanctionedList: string[] = await jsonRes.json()
        const sanctionedSet = new Set(sanctionedList)

        const clientResults: NameResult[] = []

        for (const nameClean of rawNames) {
          const normalized = normalizeClientText(nameClean)
          const isContained = sanctionedSet.has(normalized)
          clientResults.push({
            name: nameClean,
            is_contained: isContained,
            message: isContained
              ? `O nome '${nameClean}' está contido na lista CSNU.`
              : `O nome '${nameClean}' não está contido na lista do CSNU.`
          })
        }
        data = { results: clientResults }
      }

      setResults(data.results)
      setSearched(true)
      onSearchComplete?.(data.results, rawInputPayload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao consultar a lista de sanções.')
    } finally {
      setLoading(false)
    }
  }

  const sanctionedCount = results.filter(r => r.is_contained).length
  const clearCount = results.filter(r => !r.is_contained).length

  function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext === 'csv') return <FileSpreadsheet className="text-emerald-600" size={24} />
    if (ext === 'json') return <FileCode className="text-amber-600" size={24} />
    if (ext === 'pdf') return <FileText className="text-red-500" size={24} />
    return <FileIcon className="text-blue-500" size={24} />
  }

  return (
    <div className="space-y-5">
      {/* Seletor de Modo (Abas) */}
      <div className="flex p-1 bg-slate-200/70 backdrop-blur rounded-2xl border border-slate-300/40">
        <button
          type="button"
          onClick={() => { setInputMode('manual'); setError(null) }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
            inputMode === 'manual'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Type size={14} />
          Digitar nomes
        </button>

        <button
          type="button"
          onClick={() => { setInputMode('file'); setError(null) }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
            inputMode === 'file'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UploadCloud size={14} />
          Enviar arquivo (.csv, .txt, .json, .pdf)
        </button>
      </div>

      {/* Área de Entrada: Manual */}
      {inputMode === 'manual' && (
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase" style={{ letterSpacing: '0.07em' }}>
              Nomes para verificar
            </label>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {lineCount} {lineCount === 1 ? 'nome' : 'nomes'}
            </span>
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={6}
            placeholder={"Noor Wali Mehsud\nAbu Sayyaf\nAbubakar Shekau"}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition font-mono"
            style={{ fontFamily: "'JetBrains Mono', 'Menlo', monospace" }}
          />
          <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <Info size={12} />
            Digite ou cole apenas um nome por linha.
          </p>
        </div>
      )}

      {/* Área de Entrada: Arquivo */}
      {inputMode === 'file' && (
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm p-5 space-y-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={e => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
            accept=".csv,.txt,.json,.pdf"
            className="hidden"
          />

          {!selectedFile ? (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/80 hover:bg-slate-100/70 transition cursor-pointer rounded-xl p-6 text-center flex flex-col items-center justify-center space-y-2"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <UploadCloud size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Clique para selecionar ou arraste o arquivo</p>
                <p className="text-xs text-slate-400 mt-0.5">Suporta formatos .CSV, .TXT, .JSON ou .PDF</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(selectedFile.name)}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearSelectedFile}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  title="Remover arquivo"
                >
                  <X size={16} />
                </button>
              </div>

              {parsingFile ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500">
                  <Loader2 size={14} className="animate-spin" />
                  Processando e extraindo nomes do documento...
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-start gap-2.5">
                  <FileCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-800">
                    <p className="font-semibold">{fileNames.length} {fileNames.length === 1 ? 'nome encontrado' : 'nomes encontrados'}</p>
                    {fileNames.length > 0 && (
                      <p className="text-emerald-600 mt-1 line-clamp-2">
                        Exemplos: {fileNames.slice(0, 4).join(', ')}{fileNames.length > 4 ? '...' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CTA de Pagamento se necessário */}
      {!isPaid && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-3.5 text-sm text-amber-700 flex items-center gap-2.5">
          <AlertTriangle size={16} className="shrink-0" />
          Conecte sua carteira e pague <strong>0.1 USDC</strong> para liberar a verificação.
        </div>
      )}

      {/* Botão de Verificação */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => { void handleCheck() }}
        disabled={loading || activeNamesCount === 0 || !isPaid || parsingFile}
        className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-slate-900 text-white font-semibold py-4 text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-slate-800 active:bg-slate-950"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Consultando lista do CSNU…
          </>
        ) : (
          <>
            <Search size={16} />
            Verificar {activeNamesCount > 0 ? `(${activeNamesCount} ${activeNamesCount === 1 ? 'nome' : 'nomes'})` : ''} contra o CSNU
          </>
        )}
      </motion.button>

      {/* Erro */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-start gap-2.5"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de Resumo */}
      <AnimatePresence>
        {searched && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            {sanctionedCount > 0 && (
              <div className="flex-1 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
                <ShieldAlert size={16} className="text-red-500 shrink-0" />
                <span className="text-sm font-semibold text-red-700">{sanctionedCount} sancionado(s)</span>
              </div>
            )}
            {clearCount > 0 && (
              <div className="flex-1 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                <span className="text-sm font-semibold text-emerald-700">{clearCount} não listado(s)</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de Resultados */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1"
          >
            {results.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
                className={`rounded-xl px-4 py-3.5 flex items-start gap-3 border ${
                  r.is_contained
                    ? 'bg-red-50 border-red-200'
                    : 'bg-emerald-50 border-emerald-100'
                }`}
              >
                {r.is_contained ? (
                  <ShieldAlert size={16} className="text-red-500 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{r.name}</p>
                  <p className={`text-xs mt-0.5 ${r.is_contained ? 'text-red-600' : 'text-emerald-600'}`}>
                    {r.is_contained
                      ? 'Consta na lista oficial de sanções do CSNU'
                      : 'Não consta na lista do CSNU'}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

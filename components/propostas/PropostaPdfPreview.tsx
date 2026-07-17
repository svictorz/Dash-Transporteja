'use client'

import type { PropostaEmitente } from '@/lib/constants/proposta-emitentes'
import { getPropostaDoc } from '@/lib/constants/proposta-emitentes'
import type { PropostaFormState } from '@/lib/types/proposta'
import type { PropostaCalculo } from '@/lib/utils/proposta-calculo'
import { formatBRLProposta, parseDecimalBR } from '@/lib/utils/proposta-calculo'
import PropostaBrandLogo from '@/components/propostas/PropostaBrandLogo'

interface Props {
  emitente: PropostaEmitente
  form: PropostaFormState
  calc: PropostaCalculo
  dataEmissao: string
  className?: string
}

const navy = '#0f2847'
const border = '#1e293b'

export default function PropostaPdfPreview({ emitente, form, calc, dataEmissao, className }: Props) {
  const doc = getPropostaDoc(emitente)
  const fmtKg = (n: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' KG'
  const valorNf = parseDecimalBR(form.valorNf)

  const dist = form.distanciaKm.trim() ? `${form.distanciaKm.replace('.', ',')} KM` : '0 KM'

  return (
    <article
      className={`proposta-a4 proposta-a4-light-island bg-white text-black print:shadow-none ${className ?? ''}`}
      style={{
        width: '210mm',
        minHeight: '297mm',
        boxSizing: 'border-box',
        padding: '10mm 12mm',
        fontSize: '9pt',
        lineHeight: 1.35,
        fontFamily: 'system-ui, Segoe UI, sans-serif',
      }}
    >
      <header className="flex justify-between gap-4 pb-3 border-b-2" style={{ borderColor: navy }}>
        <div className="min-w-0 flex items-start">
          <PropostaBrandLogo doc={doc} />
        </div>
        <div className="text-right text-[8.5pt] max-w-[95mm] ml-auto">
          <p className="text-xl font-black tracking-tight mb-1" style={{ color: navy }}>
            PROPOSTA DE COTAÇÃO
          </p>
          <p className="text-[8pt] font-semibold text-gray-800 mb-0.5">{doc.razaoSocial}</p>
          {doc.cnpj ? <p className="text-gray-700">{doc.cnpj}</p> : null}
          <p className="text-gray-700 leading-snug">{doc.enderecoLogradouro}</p>
          <p className="text-gray-700 leading-snug">{doc.enderecoBairroCepCidade}</p>
          {doc.inscricaoEstadual ? <p className="text-gray-700">IE: {doc.inscricaoEstadual}</p> : null}
          {doc.telefone ? <p className="text-gray-700">{doc.telefone}</p> : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 mt-3 text-[8.5pt]">
        <div className="space-y-2">
          <div className="border p-2 rounded-sm" style={{ borderColor: border }}>
            <p className="font-bold text-[7.5pt] uppercase mb-0.5" style={{ color: navy }}>
              Expeditor (remetente):
            </p>
            <p className="text-gray-900">{form.remetente || '—'}</p>
          </div>
          <div className="border p-2 rounded-sm" style={{ borderColor: border }}>
            <p className="font-bold text-[7.5pt] uppercase mb-0.5" style={{ color: navy }}>
              Destinatário:
            </p>
            <p className="text-gray-900">{form.destinatario || '—'}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="border p-2 rounded-sm" style={{ borderColor: border }}>
            <p className="font-bold text-[7.5pt] uppercase mb-0.5" style={{ color: navy }}>
              Data de emissão:
            </p>
            <p>{dataEmissao}</p>
          </div>
          <div className="border p-2 rounded-sm" style={{ borderColor: border }}>
            <p className="font-bold text-[7.5pt] uppercase mb-0.5" style={{ color: navy }}>
              Código único:
            </p>
            <p className="font-bold text-sm" style={{ color: '#1d4ed8' }}>
              {form.codigoUnico}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 border rounded-sm flex" style={{ borderColor: border }}>
        <div className="flex-[3] p-2 border-r" style={{ borderColor: border }}>
          <p className="font-bold text-[7.5pt] uppercase mb-1" style={{ color: navy }}>
            Rota de atendimento:
          </p>
          <p>{calc.rotaTexto}</p>
          <p className="text-[8pt] text-gray-600 mt-1">
            {form.tipoCarga} · Prazo ref.: {form.cargaParam || '—'}
          </p>
        </div>
        <div className="flex-1 p-2 text-center flex flex-col justify-center">
          <p className="font-bold text-[7.5pt] uppercase" style={{ color: navy }}>
            Distância prevista
          </p>
          <p className="text-lg font-black mt-1" style={{ color: navy }}>
            {dist}
          </p>
        </div>
      </div>

      <table className="w-full mt-3 border-collapse text-[8.5pt]" style={{ borderColor: border }}>
        <thead>
          <tr style={{ backgroundColor: navy, color: '#fff' }}>
            <th className="border p-1.5 text-left font-semibold" style={{ borderColor: border }}>
              Peso real
            </th>
            <th className="border p-1.5 text-left font-semibold" style={{ borderColor: border }}>
              Volumes
            </th>
            <th className="border p-1.5 text-left font-semibold" style={{ borderColor: border }}>
              Valor NF
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-1.5" style={{ borderColor: border }}>
              {fmtKg(calc.pesoRealKg)}
            </td>
            <td className="border p-1.5" style={{ borderColor: border }}>
              {form.volumes.trim() || '—'}
            </td>
            <td className="border p-1.5" style={{ borderColor: border }}>
              {valorNf > 0 ? formatBRLProposta(valorNf) : '—'}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3">
        <div
          className="text-white text-center py-1.5 font-bold text-[9pt] uppercase tracking-wide"
          style={{ backgroundColor: '#334155' }}
        >
          Composição de preços
        </div>
        <div className="grid grid-cols-2 border border-t-0 text-[8.5pt]" style={{ borderColor: border }}>
          <div className="border-r p-2" style={{ borderColor: border }}>
            <span className="font-semibold">Frete base: </span>
            <strong>{formatBRLProposta(calc.freteBaseInformado)}</strong>
          </div>
          <div className="p-2">
            <span className="font-semibold">Valores adicionais: </span>
            <strong>{formatBRLProposta(calc.taxas)}</strong>
          </div>
        </div>
        <div className="border border-t-0 p-2 text-[8pt] text-gray-600 italic" style={{ borderColor: border }}>
          <span>Impostos e Seguro aproximado: </span>
          <span>{formatBRLProposta(calc.impostosSeguroValor)}</span>
        </div>
        <div className="grid grid-cols-2 border border-t-0 min-h-[4.5rem]" style={{ borderColor: border }}>
          <div className="border-r p-2 text-[8pt] text-gray-700" style={{ borderColor: border }}>
            <p className="font-bold text-gray-900 mb-0.5">Notas:</p>
            <p>Carga em conformidade legal.</p>
          </div>
          <div
            className="p-2 flex flex-col items-center justify-center text-center text-white"
            style={{ backgroundColor: navy }}
          >
            <p className="text-[8pt] font-medium opacity-90">Total líquido (CT-e)</p>
            <p className="text-lg font-black">{formatBRLProposta(calc.totalLiquido)}</p>
          </div>
        </div>
      </div>

      {form.observacao.trim() ? (
        <div
          className="mt-3 border rounded-sm p-2.5 text-[8.5pt]"
          style={{ borderColor: border }}
        >
          <p className="font-bold text-[7.5pt] uppercase mb-1" style={{ color: navy }}>
            Observações
          </p>
          <p className="text-gray-900 whitespace-pre-wrap leading-snug">{form.observacao.trim()}</p>
        </div>
      ) : null}

      <div className="mt-4 text-[8pt] text-gray-600 leading-snug">
        <p>
          Proposta válida por <strong>{doc.validadeDias} dias</strong> a partir da emissão.
          Valores sujeitos a confirmação de disponibilidade de equipamento e janela de coleta.
        </p>
        <p className="mt-1">Não inclui ajudantes, pedágios e taxas de terminal, salvo negociação expressa.</p>
      </div>

      <p
        className="text-center font-bold text-[9pt] mt-4 pt-3 border-t"
        style={{ color: navy, borderColor: border }}
      >
        {doc.slogan}
      </p>
      <p className="text-center text-[7pt] text-gray-500 mt-2">{doc.rodape}</p>
    </article>
  )
}

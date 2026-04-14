import { redirect } from 'next/navigation'

/** Cadastro de motoristas foi descontinuado no painel; mantém URL antiga. */
export default function MotoristasPage() {
  redirect('/dashboard/rotas')
}

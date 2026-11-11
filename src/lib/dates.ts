export function ajouterJours(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// 0 = dimanche … 5 = vendredi … 6 = samedi
export function jourSemaine(date: string): number {
  return new Date(date + 'T00:00:00Z').getUTCDay()
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
export const nomJour = (date: string) => JOURS[jourSemaine(date)]

// mois au format AAAA-MM → dernier jour du mois
export function finDeMois(mois: string): string {
  const [a, m] = mois.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}

export const formatDate = (date: string) => date.split('-').reverse().join('/')
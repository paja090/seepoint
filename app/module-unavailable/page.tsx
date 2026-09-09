import Link from 'next/link';
export default function ModuleUnavailable() {
  return <main className="p-8"><h1>Modul není dostupný</h1><p>Vaše organizace nemá modul aktivní nebo nemáte potřebné oprávnění.</p><Link href="/dashboard">Zpět na přehled</Link></main>;
}

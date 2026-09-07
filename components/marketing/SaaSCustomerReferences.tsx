'use client';

interface CustomerReference {
  logo?: string;
  company: string;
  author: string;
  role: string;
  quote: string;
  impact?: string;
}

/**
 * Komponenta pro budoucí klientské reference.
 * Pokud je pole prázdné, komponenta nevrací nic (return null)
 * a nevytváří fiktivní zákazníky.
 */
const CUSTOMER_REFERENCES: CustomerReference[] = [];

export function SaaSCustomerReferences() {
  if (!CUSTOMER_REFERENCES.length) {
    return null;
  }

  return (
    <section className="py-20 bg-slate-900/40 border-t border-slate-800 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
            ZKUSENOSTI Z PROVOZU
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Co říkají OOH profesionálové.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CUSTOMER_REFERENCES.map((ref, idx) => (
            <div
              key={idx}
              className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-xl"
            >
              <p className="text-sm text-slate-300 italic leading-relaxed">
                „{ref.quote}“
              </p>
              <div className="pt-4 border-t border-slate-800/80">
                <strong className="text-xs font-bold text-white block">{ref.author}</strong>
                <span className="text-[11px] text-slate-400 block">{ref.role}, {ref.company}</span>
                {ref.impact && (
                  <span className="mt-2 inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black bg-purple-950 text-purple-300 border border-purple-800">
                    {ref.impact}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

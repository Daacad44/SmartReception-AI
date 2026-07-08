const BRANDS = ['Botandev', 'Jaziira Restaurant', 'CarePlus Clinic', 'SunRise Hotels', 'Mogadishu Tech', 'Prime Real Estate'];

export function TrustBar() {
  const loop = [...BRANDS, ...BRANDS];

  return (
    <section className="reveal relative px-4 pb-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 rounded-[18px] border border-white/[0.08] bg-brand-secondary p-6 sm:flex-row sm:gap-9 sm:p-[22px_30px]">
        <div className="flex-none text-center text-sm leading-snug text-brand-muted sm:text-left">
          Trusted by 100+
          <br />
          <span className="font-bold text-white">Businesses Worldwide</span>
        </div>
        <div className="marquee-pause edge-fade-x w-full flex-1 overflow-hidden">
          <div className="flex w-max animate-marquee items-center gap-11 text-base font-semibold text-slate-300">
            {loop.map((name, i) => (
              <span key={`${name}-${i}`} className="opacity-70">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

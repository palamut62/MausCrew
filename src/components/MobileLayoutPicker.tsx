import { mobileLayouts, useMobileLayout } from "@/lib/mobile";

/**
 * The skin switch, shown in every mobile layout's settings. It changes only
 * this phone — the desktop and any other paired device keep their own view.
 */
export function MobileLayoutPicker({ className = "" }: { className?: string }) {
  const [layout, setLayout] = useMobileLayout();
  return (
    <section className={`mobile-layout-picker ${className}`.trim()} aria-label="Mobil görünüm">
      <h3>Görünüm</h3>
      <p>Bu telefonun arayüzü. Bilgisayarı ve diğer cihazları değiştirmez.</p>
      <div role="radiogroup" aria-label="Mobil görünüm seçenekleri">
        {mobileLayouts.map((item) => (
          <button
            key={item.id}
            role="radio"
            aria-checked={layout === item.id}
            onClick={() => setLayout(item.id)}
          >
            <strong>{item.name}</strong>
            <span>{item.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

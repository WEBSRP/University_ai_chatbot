import Image from "next/image";

export function Hero() {
  return (
    <section className="relative lg:pt-[122px]">
      <div className="relative z-10 overflow-hidden bg-guRed py-2.5 text-white">
        <div className="marquee-track flex w-max items-center gap-2 whitespace-nowrap text-sm font-medium md:text-base">
          <span className="flash-star text-guGold">★</span>
          <span>
            <strong>Celebrating Excellence</strong> - 18 students emerge as winners in the Swift Student Challenge 2026.
          </span>
          <a href="#" className="underline">
            Click Here
          </a>
          <span className="flash-star text-guGold">★</span>
        </div>
      </div>

      <div className="relative h-[260px] overflow-hidden xs:h-[310px] md:h-[500px] lg:h-[calc(100vw*0.364)] lg:max-h-[700px] lg:min-h-[560px]">
        <Image src="/images/banner-1.webp" alt="Galgotias University banner" fill priority className="object-cover" />
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
          <span className="h-3 w-3 rounded-full bg-white" />
          <span className="h-3 w-3 rounded-full border border-white bg-white/40" />
        </div>
        <button className="absolute left-5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-3xl text-white" aria-label="Previous slide">
          ‹
        </button>
        <button className="absolute right-5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-3xl text-white" aria-label="Next slide">
          ›
        </button>
      </div>
    </section>
  );
}

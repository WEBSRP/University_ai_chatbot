const centres = [
  "Galgotias Centre for Supercomputing & Advanced AI Research",
  "Advanced Geotechnical and Earth Science Centre",
  "HP-Intel AI for Future Workforce Lab",
  "Galgotias Centre for Drone Intelligence & Simulation"
];

export function AcademicCentres() {
  return (
    <section className="bg-white py-14 md:py-20">
      <div className="container-gu">
        <h1 className="text-center font-mont text-3xl font-semibold text-neutral-900 md:text-5xl">Galgotias University</h1>
        <h2 className="mt-4 text-center font-mont text-2xl font-semibold text-neutral-900 md:text-4xl">
          Industry Integrated Academic Centres
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {centres.map((centre, index) => (
            <article className="overflow-hidden border border-neutral-200 bg-white shadow-sm" key={centre}>
              <div className="h-40 bg-[linear-gradient(135deg,#d8d8d8,#f5f5f5)]">
                <div className="flex h-full items-center justify-center px-6 text-center font-mont text-lg font-semibold text-guDeep">
                  Centre {index + 1}
                </div>
              </div>
              <a href="#" className="flex min-h-[70px] items-center justify-center bg-guRed px-4 text-center text-sm font-medium leading-5 text-white">
                {centre}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

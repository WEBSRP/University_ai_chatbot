const schools = [
  "School of Computer Science and Engineering",
  "School of Artificial Intelligence",
  "School of Skill Sciences & Entrepreneurship",
  "School of Aviation, Logistics & Tourism Management",
  "School of Forensic Sciences",
  "School of Computer Applications & Technology",
  "School of Engineering",
  "School of Business"
];

export function Schools() {
  return (
    <section className="bg-[#f5f5f5] py-16 md:py-20">
      <div className="container-gu">
        <div className="text-center">
          <h2 className="font-mont text-3xl font-semibold uppercase text-neutral-900 md:text-5xl">Schools at Galgotias University</h2>
          <p className="mt-4 text-xl text-neutral-700 md:text-3xl">Excellence is what we strive to achieve</p>
          <div className="mx-auto mt-8 flex max-w-xl items-center bg-white p-2 shadow-sm">
            <span className="px-4 font-mont text-sm font-medium text-neutral-700 md:text-base">Find The Program</span>
            <div className="h-11 flex-1 bg-neutral-100" />
            <span className="grid h-11 w-12 place-items-center bg-guRed text-white">⌕</span>
          </div>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {schools.map((school) => (
            <a className="group bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-lg" href="#" key={school}>
              <div className="h-36 bg-[linear-gradient(135deg,#9b1b20,#ededed)] transition group-hover:brightness-105" />
              <p className="min-h-[64px] px-1 pt-4 text-center text-sm font-medium leading-5 text-neutral-900">{school}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

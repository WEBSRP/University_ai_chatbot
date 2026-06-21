const quickLinks = [
  "Examination",
  "Beyond Academics",
  "Covid-19 Counselling Cell",
  "Student Login",
  "Work With Us",
  "Swayam",
  "Digital Learning",
  "National Academic Depository",
  "Awards, Rankings & Certifications",
  "Admission & Education Loan Assistance",
  "Download Forms",
  "Tender & Vendor Registration",
  "Convocation",
  "Galgotias University Vision 2030",
  "Policy",
  "Galgotias News Network (GNN)",
  "Virtual Tour",
  "Blog",
  "Fees Payment",
  "Sports"
];

const social = ["f", "in", "ig", "x", "yt", "wa", "gnn"];

export function Footer() {
  return (
    <footer className="bg-guDeep pt-14 text-white">
      <div className="container-gu">
        <div className="border-b border-white/25 pb-10">
          <h3 className="mb-6 font-mont text-xl font-semibold uppercase">Quick Links</h3>
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {quickLinks.map((link) => (
              <a href="#" className="footer-link" key={link}>
                {link}
              </a>
            ))}
          </div>
        </div>

        <div className="grid gap-10 py-10 lg:grid-cols-2">
          <div>
            <h3 className="mb-6 font-mont text-xl font-semibold uppercase">Reach Us</h3>
            <div className="space-y-3 text-sm text-white/90">
              <p>registrar@galgotiasuniversity.edu.in</p>
              <p>vcoffice@galgotiasuniversity.edu.in</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {social.map((item) => (
                <a
                  className="grid h-9 min-w-9 place-items-center rounded bg-white px-2 text-xs font-semibold uppercase text-guDeep"
                  href="#"
                  key={item}
                >
                  {item}
                </a>
              ))}
            </div>
            <div className="mt-10">
              <h3 className="mb-4 font-mont text-xl font-semibold uppercase">UGC Public Self Portal</h3>
              <a href="#" className="footer-link">
                Chat with an Ambassadors
              </a>
            </div>
          </div>

          <div>
            <h3 className="mb-6 font-mont text-xl font-semibold uppercase">Locate Us</h3>
            <p className="mb-5 text-sm leading-7 text-white/90">
              Plot No.2, Sector 17-A Yamuna Expressway, Opposite Buddha International Circuit, Greater Noida, Gautam Buddh
              Nagar, Uttar Pradesh 203201
            </p>
            <div className="h-[265px] border-4 border-white/15 bg-[linear-gradient(135deg,#e8e8e8,#b9b9b9)] p-6 text-guDeep">
              <div className="flex h-full items-center justify-center text-center font-mont text-xl font-semibold">
                Galgotias University, Greater Noida
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#5f0d12] py-5">
        <div className="container-gu flex flex-col gap-3 text-sm text-white/85 lg:flex-row lg:items-center lg:justify-between">
          <p>© 2026 Copyrights Galgotias. All rights reserved.</p>
          <div className="flex gap-5">
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
          </div>
          <p>Designed, developed & maintained By : City Innovates</p>
        </div>
      </div>
    </footer>
  );
}

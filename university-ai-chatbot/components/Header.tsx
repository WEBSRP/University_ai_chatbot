import Image from "next/image";
import { useState } from "react";

const topLinks = [
  "Bihar Student Credit card scheme",
  "Apply Now",
  "International Admissions",
  "Alumni",
  "NIRF",
  "NAAC",
  "Campus Life",
  "Online Complaints",
  "Innovation",
  "Announcements",
  "Degree verification",
  "Career"
];

const navItems = [
  {
    label: "About GU",
    columns: [
      ["About Us", "Galgotias University", "Our Legacy", "The Galgotias Story", "Management", "Governance"],
      ["Industry Integrated Academic Centres", "Awards, Rankings & Certifications", "Accreditations", "Mandatory Disclosures", "Policies & Regulations"]
    ]
  },
  {
    label: "Schools",
    columns: [
      ["School of Computer Science and Engineering", "School of Artificial Intelligence", "School of Skill Sciences", "School of Aviation, Logistics & Tourism"],
      ["School of Forensic Sciences", "School of Engineering", "School of Business", "School of Law"]
    ]
  },
  {
    label: "Programs",
    columns: [["Certificate Programs", "Diploma Programs", "Under Graduate Programs", "Postgraduate Programs", "Doctoral Programs"]]
  },
  {
    label: "Admissions",
    columns: [["Apply Now", "Admission Procedure", "Fee Structure & Eligibility", "Scholarships", "Hostel", "Download Brochure"]]
  },
  {
    label: "Research",
    columns: [["Research Excellence", "Research & Development Cell", "Patents", "Publications", "Centres of Excellence"]]
  },
  {
    label: "Academics",
    columns: [["Academics", "Academic Calendar", "Learning Model", "MOUs", "NEP-2020", "Download Forms"]]
  },
  {
    label: "Placements",
    columns: [["Latest Placements", "Career Planning Division", "Associated Recruiters", "Placement Records", "Placement Brochure"]]
  }
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-50 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.08)] lg:fixed lg:inset-x-0 lg:top-0">
      <div className="bg-guRed">
        <div className="container-gu flex min-h-10 items-center overflow-x-auto">
          <div className="flex items-center gap-6 py-3">
            {topLinks.map((link) => (
              <a className="top-link" href="#" key={link}>
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="container-gu">
        <nav className="flex min-h-[82px] items-center justify-between gap-5">
          <a href="#" className="relative h-[54px] w-[270px] max-w-[68vw] shrink-0">
            <Image src="/images/logo.png" alt="Galgotias University" fill priority className="object-contain" />
          </a>

          <button
            type="button"
            className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded border border-neutral-300 lg:hidden"
            aria-label="Toggle navigation"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="h-0.5 w-6 bg-neutral-800" />
            <span className="h-0.5 w-6 bg-neutral-800" />
            <span className="h-0.5 w-6 bg-neutral-800" />
          </button>

          <div
            className={`absolute left-0 right-0 top-full bg-white px-5 pb-5 shadow-xl lg:static lg:block lg:bg-transparent lg:p-0 lg:shadow-none ${
              open ? "block" : "hidden"
            }`}
          >
            <ul className="flex flex-col lg:flex-row lg:items-center lg:justify-end">
              {navItems.map((item) => (
                <li className="nav-group lg:relative" key={item.label}>
                  <a className="nav-link-gu" href="#">
                    {item.label}
                  </a>
                  <div className="mega-panel absolute right-0 top-full w-[760px] rounded-b bg-white p-6 shadow-2xl">
                    <div className="grid grid-cols-[230px_1fr] gap-6">
                      <div className="h-40 bg-[linear-gradient(135deg,#bc1820,#7f1118)] p-5 text-white">
                        <p className="font-mont text-2xl font-semibold">{item.label}</p>
                        <p className="mt-3 text-sm leading-6 opacity-90">Explore Galgotias University resources and departments.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                        {item.columns.map((column, index) => (
                          <ul className="space-y-3" key={`${item.label}-${index}`}>
                            {column.map((entry) => (
                              <li key={entry}>
                                <a className="text-sm text-neutral-700 hover:text-guRed" href="#">
                                  {entry}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              <li>
                <a className="block px-3 py-4 font-mont text-[15px] font-medium text-neutral-900 hover:text-guRed lg:py-[31px]" href="#">
                  Sustainability
                </a>
              </li>
              <li>
                <a className="block px-3 py-4 font-mont text-[15px] font-medium text-neutral-900 hover:text-guRed lg:py-[31px]" href="#">
                  Launchpad
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <a href="#" className="floating-tab right-[-41px] top-[46vh]">
        Apply Now
      </a>
      <a href="#" className="floating-tab left-[-75px] top-[42vh]">
        Convocation 2026
      </a>
    </header>
  );
}

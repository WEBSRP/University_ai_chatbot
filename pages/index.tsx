import Head from "next/head";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { AcademicCentres } from "@/components/AcademicCentres";
import { Schools } from "@/components/Schools";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Head>
        <title>India's Leading Private University in Noida & Delhi - Galgotias University</title>
        <meta
          name="description"
          content="A frontend clone of Galgotias University homepage built with Next.js, TypeScript, and Tailwind CSS."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="page-shell">
        <Header />
        <main>
          <Hero />
          <AcademicCentres />
          <Schools />
        </main>
        <Footer />
      </div>
    </>
  );
}

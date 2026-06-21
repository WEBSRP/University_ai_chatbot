import type { NextApiRequest, NextApiResponse } from "next";
import { getCatalog } from "@/lib/catalog";

type CatalogResponse =
  | {
      sections: Awaited<ReturnType<typeof getCatalog>>;
    }
  | {
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CatalogResponse>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({ sections: await getCatalog() });
}

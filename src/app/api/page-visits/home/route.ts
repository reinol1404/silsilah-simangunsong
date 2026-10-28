import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const PAGE = "home";
const VISITOR_COOKIE = "home_visitor_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Mencatat browser anonim yang membuka halaman utama. */
export async function POST(request: NextRequest) {
  try {
    let visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
    const isNewVisitor = !visitorId;

    if (!visitorId) visitorId = crypto.randomUUID();

    await prisma.pageVisitor.upsert({
      where: { page_visitorId: { page: PAGE, visitorId } },
      update: {},
      create: { page: PAGE, visitorId },
    });

    const total = await prisma.pageVisitor.count({ where: { page: PAGE } });
    const response = NextResponse.json({ success: true, data: { total } });

    if (isNewVisitor) {
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: ONE_YEAR,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("POST /api/page-visits/home error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mencatat pengunjung" },
      { status: 500 },
    );
  }
}

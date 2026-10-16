// app/api/person/route.ts
// GET  /api/person          → semua person (dengan relasi)
// GET  /api/person?cari=xxx → pencarian nama
// POST /api/person          → tambah person baru

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cari = searchParams.get("cari") || "";
    const id = searchParams.get("id");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Jika ada ID, ambil person by ID dengan full relasi untuk profil page
    if (id) {
      const person = await prisma.person.findUnique({
        where: { id: parseInt(id) },
        include: {
          marriagesAsHusband: {
            include: {
              wife: true,
              children: {
                include: {
                  person: true,
                },
              },
            },
          },
          marriagesAsWife: {
            include: {
              husband: true,
              children: {
                include: {
                  person: true,
                },
              },
            },
          },
          children: {
            include: {
              marriage: {
                include: {
                  husband: {
                    include: {
                      children: {
                        include: {
                          marriage: {
                            include: {
                              husband: true,
                              wife: true,
                            },
                          },
                        },
                      },
                    },
                  },
                  wife: {
                    include: {
                      children: {
                        include: {
                          marriage: {
                            include: {
                              husband: true,
                              wife: true,
                            },
                          },
                        },
                      },
                    },
                  },
                  children: {
                    include: {
                      person: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!person) {
        return NextResponse.json(
          { success: false, message: "Person not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: [person] });
    }

    // Default: list persons
    const persons = await prisma.person.findMany({
      where: cari
        ? {
            OR: [
              { nama:        { contains: cari } },
              { tempatLahir: { contains: cari } },
            ],
          }
        : undefined,
      include: {
        // pernikahan sebagai suami → dapat info istri & anak-anak
        marriagesAsHusband: {
          include: {
            wife:     { select: { id: true, nama: true, foto: true } },
            children: {
              include: {
                person: { select: { id: true, nama: true, jenisKelamin: true, foto: true } },
              },
            },
          },
        },
        // pernikahan sebagai istri → dapat info suami
        marriagesAsWife: {
          include: {
            husband: { select: { id: true, nama: true, foto: true } },
          },
        },
      },
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, data: persons });
  } catch (error) {
    console.error("GET /api/person error:", error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Cek autentikasi admin
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized - Silakan login terlebih dahulu" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { nama, jenisKelamin, tanggalLahir, tanggalWafat, tempatLahir, foto } = body;

    if (!nama || !jenisKelamin) {
      return NextResponse.json(
        { success: false, message: "Nama dan jenis kelamin wajib diisi" },
        { status: 400 }
      );
    }

    const person = await prisma.person.create({
      data: {
        nama,
        jenisKelamin,
        tanggalLahir:  tanggalLahir  ? new Date(tanggalLahir)  : null,
        tanggalWafat:  tanggalWafat  ? new Date(tanggalWafat)  : null,
        tempatLahir:   tempatLahir   || null,
        foto:          foto          || null,
      },
    });

    return NextResponse.json({ success: true, data: person }, { status: 201 });
  } catch (error) {
    console.error("POST /api/person error:", error);
    return NextResponse.json({ success: false, message: "Gagal menyimpan data" }, { status: 500 });
  }
}

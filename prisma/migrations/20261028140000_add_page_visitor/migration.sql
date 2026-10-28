-- Pengunjung unik per halaman, berdasarkan ID browser anonim dalam cookie.
CREATE TABLE "PageVisitor" (
    "id" SERIAL NOT NULL,
    "page" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "firstVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageVisitor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PageVisitor_page_visitorId_key"
ON "PageVisitor"("page", "visitorId");

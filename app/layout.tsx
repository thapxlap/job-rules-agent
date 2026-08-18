import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = { title: "회사생활가이드", description: "취업 규칙 등록 및 검색 MVP" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body><header className="topbar"><Link href="/">취업 규칙 검색</Link><nav><Link href="/admin">인덱싱</Link><Link href="/setup">프로젝트 설정</Link></nav></header>{children}</body></html>; }

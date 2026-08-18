import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = { title: "회사생활 가이드", description: "회사 생활 지원 검색 MVP" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body><header className="topbar"><Link href="/">회사생활가이드</Link><nav><Link href="/admin">업무문서등록</Link><Link href="/setup">프로젝트 설정</Link></nav></header>{children}</body></html>; }

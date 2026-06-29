import { redirect } from "next/navigation";

export default function Home() {
  // 首页默认跳转到工作台
  redirect("/workspace");
}

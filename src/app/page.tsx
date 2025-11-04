"use client";
import type { User } from "firebase/auth";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Trash2, Plus, LogOut } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart as RLineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

// =============== Firebase ===============
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs, addDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
import { ValueType } from "recharts/types/component/DefaultTooltipContent";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =============== Constantes/UI ===============
const CATEGORIAS = {
  Receita: ["Salário", "13º", "Bônus", "Freelance", "Rendimentos", "Reembolsos", "Outros"],
  Despesa: ["Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Contas da casa", "Assinaturas", "Vestuário", "Impostos", "Pets", "Outros"],
  Investimento: ["Poupança", "Tesouro Direto", "CDB", "Fundos", "Ações", "Previdência", "Cripto", "Outros"],
};
const FORMAS = ["PIX", "Cartão Débito", "Cartão Crédito", "Dinheiro", "Transferência", "Boleto"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function cpfToEmail(cpf: string): string {
  const digits = String(cpf || "").replace(/\D/g, "");
  return `${digits}@login.local`;
}

function moeda(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseNumber(v: string | number): number {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return isNaN(n) ? 0 : n;
}

// =============== App ===============
export default function App() {
const [user, setUser] = useState<User | null>(null);
  type Perfil = { uid: string; nome?: string; cpf?: string; dob?: string; role?: "admin" | "user" } | null;
const [profile, setProfile] = useState<Perfil>(null);
const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async function (u) {
        setUser(u);
        if (u) {
          const q = query(collection(db, "profiles"), where("uid", "==", u.uid));
          const s = await getDocs(q);
          if (!s.empty) setPerfil(s.docs[0].data());
        } else {
          setPerfil(null);
        }
        setLoading(false);
      });
    return () => unsub();
  }, []);

  if (loading) return <div className="min-h-screen grid place-items-center">Carregando…</div>;
  if (!user) return <Login />;
  return <AppShell user={user} perfil={perfil} />;
}

function Login() {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  async function entrar(e) {
    e.preventDefault();
    setErro("");
    try {
      const email = cpfToEmail({ cpf: (cpf || "").replace(/\D/g, "") });
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (e) {
      setErro("CPF ou senha inválidos.");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-white">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Entrar</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={entrar} className="grid gap-3">
            <div className="grid gap-1"><Label>CPF</Label><Input value={cpf} onChange={(e)=>setCpf(e.target.value)} placeholder="somente números" required /></div>
            <div className="grid gap-1"><Label>Senha</Label><Input type="password" value={senha} onChange={(e)=>setSenha(e.target.value)} required /></div>
            {erro && <div className="text-sm text-red-600">{erro}</div>}
            <Button type="submit" className="mt-2">Entrar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AppShell({ user, perfil }) {
  const [aba, setAba] = useState("dashboard");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);

  const [transacoes, setTransacoes] = useState([]);
  const [metas, setMetas] = useState([]);
  const [dividas, setDividas] = useState([]);

  useEffect(() => { (async () => {
    const tx = await getDocs(query(collection(db, "transactions"), where("uid", "==", user.uid)));
    setTransacoes(tx.docs.map(d=>({ id: d.id, ...d.data() })));
    const gs = await getDocs(query(collection(db, "goals"), where("uid", "==", user.uid)));
    setMetas(gs.docs.map(d=>({ id: d.id, ...d.data() })));
    const ds = await getDocs(query(collection(db, "debts"), where("uid", "==", user.uid)));
    setDividas(ds.docs.map(d=>({ id: d.id, ...d.data() })));
  })(); }, [user.uid]);

  async function addTransacao(reg) {
    const ref = await addDoc(collection(db, "transactions"), { uid: user.uid, ...reg });
    setTransacoes((p)=>[{ id: ref.id, uid: user.uid, ...reg }, ...p]);
  }
  async function delTransacao(id) { await deleteDoc(doc(db, "transactions", id)); setTransacoes(p=>p.filter(x=>x.id!==id)); }

  async function addMeta(meta) { const ref = await addDoc(collection(db, "goals"), { uid: user.uid, ...meta }); setMetas(p=>[{ id: ref.id, uid:user.uid, ...meta }, ...p]); }
  async function delMeta(id) { await deleteDoc(doc(db, "goals", id)); setMetas(p=>p.filter(x=>x.id!==id)); }

  async function addDivida(d) { const ref = await addDoc(collection(db, "debts"), { uid: user.uid, ...d }); setDividas(p=>[{ id: ref.id, uid:user.uid, ...d }, ...p]); }
  async function delDivida(id) { await deleteDoc(doc(db, "debts", id)); setDividas(p=>p.filter(x=>x.id!==id)); }

  const txAno = useMemo(() => transacoes.filter(t => new Date(t.data).getFullYear() === Number(ano)), [transacoes, ano]);
  const txMes = useMemo(() => txAno.filter(t => (new Date(t.data).getMonth()+1) === Number(mes)), [txAno, mes]);
  const totaisM = useMemo(() => {
    const r = txMes.filter(t=>t.tipo==="Receita").reduce((s,t)=>s+t.valor,0);
    const d = txMes.filter(t=>t.tipo==="Despesa").reduce((s,t)=>s+t.valor,0);
    const i = txMes.filter(t=>t.tipo==="Investimento").reduce((s,t)=>s+t.valor,0);
    return { receita:r, despesa:d, investimento:i, saldo:r-d-i };
  }, [txMes]);
  const despesasPorCategoriaM = useMemo(() => {
    const mapa = {}; txMes.filter(t=>t.tipo==="Despesa").forEach(t=>{ mapa[t.categoria]=(mapa[t.categoria]||0)+t.valor; });
    return Object.entries(mapa).map(([categoria, total])=>({ categoria, total }));
  }, [txMes]);
  function daysInMonth(y,m){ return new Date(y,m,0).getDate(); }
  const dailySaldo = useMemo(()=>{ const days=daysInMonth(Number(ano),Number(mes)); let a=0; const data=[]; for(let d=1; d<=days; d++){ const doDia=txMes.filter(t=>new Date(t.data).getDate()===d); const rr=doDia.filter(t=>t.tipo==="Receita").reduce((s,t)=>s+t.valor,0); const dd=doDia.filter(t=>t.tipo==="Despesa").reduce((s,t)=>s+t.valor,0); const ii=doDia.filter(t=>t.tipo==="Investimento").reduce((s,t)=>s+t.valor,0); a+=rr-dd-ii; data.push({ dia:d, saldoAcum:a }); } return data; }, [txMes, ano, mes]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="size-8 rounded-xl bg-gray-900" /><h1 className="text-lg font-semibold tracking-tight">Finance App</h1></div>
          <div className="flex items-center gap-2">
            <Select value={String(mes)} onValueChange={(v)=>setMes(Number(v))}><SelectTrigger className="w-36"><SelectValue placeholder="Mês"/></SelectTrigger><SelectContent>{MESES.map((mNome,i)=>(<SelectItem key={mNome} value={String(i+1)}>{`${i+1} - ${mNome}`}</SelectItem>))}</SelectContent></Select>
            <Input type="number" value={ano} onChange={(e)=>setAno(Number(e.target.value))} className="w-28" placeholder="Ano" />
            {perfil && <span className="text-sm text-muted-foreground">Olá, {perfil.nome} ({perfil.role||"user"})</span>}
            <Button variant="outline" onClick={()=>signOut(auth)}><LogOut className="mr-2 h-4 w-4"/>Sair</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="grid grid-cols-4 sm:grid-cols-5">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="transacoes">Transações</TabsTrigger>
            <TabsTrigger value="metas">Metas</TabsTrigger>
            <TabsTrigger value="dividas">Dívidas</TabsTrigger>
            {perfil?.role==="admin" && <TabsTrigger value="usuarios">Usuários</TabsTrigger>}
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPI title={`Receitas (${MESES[Number(mes)-1]}/${ano})`} value={moeda(totaisM.receita)} />
              <KPI title={`Despesas (${MESES[Number(mes)-1]}/${ano})`} value={moeda(totaisM.despesa)} />
              <KPI title={`Investimentos (${MESES[Number(mes)-1]}/${ano})`} value={moeda(totaisM.investimento)} />
              <KPI title={`Saldo (${MESES[Number(mes)-1]}/${ano})`} value={moeda(totaisM.saldo)} highlight />
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2"><CardHeader><CardTitle>Evolução do Saldo (diária — mês)</CardTitle></CardHeader><CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%"><RLineChart data={dailySaldo} margin={{left:8,right:8}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="dia"/><YAxis/><Tooltip formatter={(v)=>moeda(v)} /><Line type="monotone" dataKey="saldoAcum" strokeWidth={2} dot={false}/></RLineChart></ResponsiveContainer>
              </CardContent></Card>
              <Card><CardHeader><CardTitle>Despesas por Categoria (mês)</CardTitle></CardHeader><CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie dataKey="total" data={despesasPorCategoriaM} nameKey="categoria" outerRadius={90}>{despesasPorCategoriaM.map((_,i)=>(<Cell key={i}/>))}</Pie><Tooltip formatter={(v)=>moeda(v)} /><Legend/></PieChart></ResponsiveContainer>
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="transacoes" className="mt-6">
            <Transacoes mes={mes} ano={ano} transacoes={txMes} onAdd={addTransacao} onDel={delTransacao} />
          </TabsContent>

          <TabsContent value="metas" className="mt-6"><Metas metas={metas} onAdd={addMeta} onDel={delMeta} /></TabsContent>
          <TabsContent value="dividas" className="mt-6"><Dividas dividas={dividas} onAdd={addDivida} onDel={delDivida} /></TabsContent>
          {perfil?.role==="admin" && <TabsContent value="usuarios" className="mt-6"><UsuariosAdmin /></TabsContent>}
        </Tabs>
      </main>
    </div>
  );
}

function KPI({ title, value, highlight }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className={highlight ? "border-gray-900" : undefined}>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
        <CardContent><div className="text-2xl font-semibold tracking-tight">{value}</div></CardContent>
      </Card>
    </motion.div>
  );
}

function Transacoes({ mes, ano, transacoes, onAdd, onDel }) {
  const [form, setForm] = useState({ data: "", descricao: "", tipo: "Despesa", categoria: "Alimentação", valor: "", forma: "PIX" });
  function submit(e){ e.preventDefault(); if(!form.data||!form.tipo||!form.categoria||!form.valor) return; onAdd({ ...form, valor: parseNumber(form.valor) }); setForm({ ...form, data:"", descricao:"", valor:"" }); }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1"><CardHeader><CardTitle>Adicionar Transação</CardTitle></CardHeader><CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-2"><Label>Data</Label><Input type="date" value={form.data} onChange={(e)=>setForm({ ...form, data: e.target.value })} required/></div>
          <div className="grid gap-2"><Label>Descrição</Label><Input value={form.descricao} onChange={(e)=>setForm({ ...form, descricao: e.target.value })} placeholder="ex.: Supermercado"/></div>
          <div className="grid gap-2"><Label>Tipo</Label><Select value={form.tipo} onValueChange={(v)=>setForm(s=>({ ...s, tipo: v, categoria: CATEGORIAS[v][0] }))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.keys(CATEGORIAS).map(t=>(<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent></Select></div>
          <div className="grid gap-2"><Label>Categoria</Label><Select value={form.categoria} onValueChange={(v)=>setForm(s=>({ ...s, categoria: v }))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CATEGORIAS[form.tipo].map(c=>(<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent></Select></div>
          <div className="grid gap-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e)=>setForm({ ...form, valor: e.target.value })} required/></div>
          <div className="grid gap-2"><Label>Forma de Pagamento</Label><Select value={form.forma} onValueChange={(v)=>setForm({ ...form, forma: v })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{FORMAS.map(f=>(<SelectItem key={f} value={f}>{f}</SelectItem>))}</SelectContent></Select></div>
          <Button type="submit" className="mt-2"><Plus className="mr-2 h-4 w-4"/>Adicionar</Button>
        </form>
      </CardContent></Card>

      <Card className="lg:col-span-2"><CardHeader><CardTitle>Transações ({MESES[Number(mes)-1]}/{ano})</CardTitle></CardHeader><CardContent>
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left"><tr>{["Data","Descrição","Tipo","Categoria","Valor","Forma",""] .map(h=>(<th key={h} className="px-3 py-2 font-medium">{h}</th>))}</tr></thead>
            <tbody>
              {transacoes.length===0 && (<tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>Nenhuma transação</td></tr>)}
              {transacoes.sort((a,b)=>new Date(b.data)-new Date(a.data)).map(t=>(
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2">{new Date(t.data).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{t.descricao||"—"}</td>
                  <td className="px-3 py-2">{t.tipo}</td>
                  <td className="px-3 py-2">{t.categoria}</td>
                  <td className="px-3 py-2">{moeda(t.valor)}</td>
                  <td className="px-3 py-2">{t.forma}</td>
                  <td className="px-3 py-2 text-right"><Button variant="ghost" size="icon" onClick={()=>onDel(t.id)} title="Remover"><Trash2 className="h-4 w-4"/></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

function Metas({ metas, onAdd, onDel }) {
  const [form, setForm] = useState({ objetivo: "", total: "", atual: "", prazo: "" });
  function submit(e){ e.preventDefault(); if(!form.objetivo||!form.total) return; onAdd({ objetivo: form.objetivo, total: parseNumber(form.total), atual: parseNumber(form.atual||0), prazo: form.prazo }); setForm({ objetivo:"", total:"", atual:"", prazo:"" }); }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1"><CardHeader><CardTitle>Adicionar Meta</CardTitle></CardHeader><CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1"><Label>Objetivo</Label><Input value={form.objetivo} onChange={(e)=>setForm({ ...form, objetivo: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Valor Total (R$)</Label><Input type="number" step="0.01" value={form.total} onChange={(e)=>setForm({ ...form, total: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Valor Atual (R$)</Label><Input type="number" step="0.01" value={form.atual} onChange={(e)=>setForm({ ...form, atual: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Prazo (mês/ano)</Label><Input placeholder="mm/aaaa" value={form.prazo} onChange={(e)=>setForm({ ...form, prazo: e.target.value })} /></div>
          <Button type="submit" className="mt-2"><Plus className="mr-2 h-4 w-4"/>Adicionar</Button>
        </form>
      </CardContent></Card>
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Lista de Metas</CardTitle></CardHeader><CardContent>
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left"><tr>{["Objetivo","Total","Atual","%","Prazo",""] .map(h=>(<th key={h} className="px-3 py-2 font-medium">{h}</th>))}</tr></thead>
            <tbody>
              {metas.length===0 && (<tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhuma meta</td></tr>)}
              {metas.map((m)=>{ const pct = m.total>0 ? (m.atual/m.total) : 0; return (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2">{m.objetivo}</td>
                  <td className="px-3 py-2">{moeda(m.total)}</td>
                  <td className="px-3 py-2">{moeda(m.atual)}</td>
                  <td className="px-3 py-2">{(pct*100).toFixed(0)}%</td>
                  <td className="px-3 py-2">{m.prazo||"—"}</td>
                  <td className="px-3 py-2 text-right"><Button variant="ghost" size="icon" onClick={()=>onDel(m.id)}><Trash2 className="h-4 w-4"/></Button></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

function Dividas({ dividas, onAdd, onDel }) {
  const [form, setForm] = useState({ descricao: "", total: "", parcelas: "", valorParcela: "", vencimento: "", pago: false });
  function submit(e){ e.preventDefault(); if(!form.descricao||!form.total) return; onAdd({ descricao: form.descricao, total: parseNumber(form.total), parcelas: Number(form.parcelas||0), valorParcela: parseNumber(form.valorParcela||0), vencimento: form.vencimento, pago: !!form.pago }); setForm({ descricao:"", total:"", parcelas:"", valorParcela:"", vencimento:"", pago:false }); }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1"><CardHeader><CardTitle>Adicionar Dívida</CardTitle></CardHeader><CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1"><Label>Descrição</Label><Input value={form.descricao} onChange={(e)=>setForm({ ...form, descricao: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Valor Total (R$)</Label><Input type="number" step="0.01" value={form.total} onChange={(e)=>setForm({ ...form, total: e.target.value })} /></div>
          <div className="grid gap-1 sm:grid-cols-3 sm:gap-3">
            <div><Label>Nº Parcelas</Label><Input type="number" value={form.parcelas} onChange={(e)=>setForm({ ...form, parcelas: e.target.value })} /></div>
            <div><Label>Valor Parcela</Label><Input type="number" step="0.01" value={form.valorParcela} onChange={(e)=>setForm({ ...form, valorParcela: e.target.value })} /></div>
            <div><Label>Vencimento</Label><Input type="date" value={form.vencimento} onChange={(e)=>setForm({ ...form, vencimento: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2"><Checkbox id="pago" checked={form.pago} onCheckedChange={(v)=>setForm({ ...form, pago: Boolean(v) })} /><Label htmlFor="pago">Pago?</Label></div>
          <Button type="submit" className="mt-2"><Plus className="mr-2 h-4 w-4"/>Adicionar</Button>
        </form>
      </CardContent></Card>
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Lista de Dívidas</CardTitle></CardHeader><CardContent>
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left"><tr>{["Descrição","Total","Parcelas","Vlr Parcela","Vencimento","Pago?",""] .map(h=>(<th key={h} className="px-3 py-2 font-medium">{h}</th>))}</tr></thead>
            <tbody>
              {dividas.length===0 && (<tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nenhuma dívida</td></tr>)}
              {dividas.map((d)=>(
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2">{d.descricao}</td>
                  <td className="px-3 py-2">{moeda(d.total)}</td>
                  <td className="px-3 py-2">{d.parcelas||"—"}</td>
                  <td className="px-3 py-2">{d.valorParcela?moeda(d.valorParcela):"—"}</td>
                  <td className="px-3 py-2">{d.vencimento?new Date(d.vencimento).toLocaleDateString():"—"}</td>
                  <td className="px-3 py-2">{d.pago?"Sim":"Não"}</td>
                  <td className="px-3 py-2 text-right"><Button variant="ghost" size="icon" onClick={()=>onDel(d.id)}><Trash2 className="h-4 w-4"/></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ====== Admin: gestão de perfis (somente Firestore; criação de contas via Console) ======
function UsuariosAdmin(){
  const [lista, setLista] = useState([]);
  const [q, setQ] = useState("");
  async function carregar(){ const s = await getDocs(query(collection(db, "profiles"))); setLista(s.docs.map(d=>({ id:d.id, ...d.data() }))); }
  useEffect(()=>{carregar();},[]);
  async function salvar(u){ const ref = doc(db, "profiles", u.id); await setDoc(ref, u); await carregar(); }
  return (
    <Card>
      <CardHeader><CardTitle>Usuários (admin)</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center gap-2"><Input placeholder="Filtrar por nome/CPF" value={q} onChange={(e)=>setQ(e.target.value)} className="max-w-sm" /><Button variant="outline" onClick={carregar}>Atualizar</Button></div>
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left"><tr>{["Nome","CPF","Nascimento","Papel",""] .map(h=>(<th key={h} className="px-3 py-2 font-medium">{h}</th>))}</tr></thead>
            <tbody>
              {lista.filter(u=>{ const s=(q||"").toLowerCase(); if(!s) return true; return (u.nome||"").toLowerCase().includes(s) || (u.cpf||"").includes(s); }).map(u=>(<UsuarioRow key={u.id} u={u} onSave={salvar}/>))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Observação: Criação de contas e alteração de senha via <strong>Firebase Console → Authentication</strong>. Esta tela edita apenas o perfil no Firestore.</p>
      </CardContent>
    </Card>
  );
}

function UsuarioRow({ u, onSave }){
  const [e, setE] = useState(u);
  return (
    <tr className="border-t">
      <td className="px-3 py-2"><Input value={e.nome||""} onChange={(ev)=>setE({ ...e, nome: ev.target.value })} /></td>
      <td className="px-3 py-2"><Input value={e.cpf||""} onChange={(ev)=>setE({ ...e, cpf: ev.target.value })} /></td>
      <td className="px-3 py-2"><Input value={e.dob||""} onChange={(ev)=>setE({ ...e, dob: ev.target.value })} placeholder="07-08-1994"/></td>
      <td className="px-3 py-2">
        <Select value={e.role||"user"} onValueChange={(v)=>setE({ ...e, role: v })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="user">user</SelectItem><SelectItem value="admin">admin</SelectItem></SelectContent></Select>
      </td>
      <td className="px-3 py-2 text-right"><Button variant="outline" onClick={()=>onSave(e)}>Salvar</Button></td>
    </tr>
  );
}

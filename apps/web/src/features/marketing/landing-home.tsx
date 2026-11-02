import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUpLeft, CalendarDays, Check, CheckCheck, CirclePlay, Clock3, Cloud, FileCheck2, FolderKanban, LayoutDashboard, ListTodo, MessageCircle, MoreHorizontal, Paperclip, Search, Server, Settings2, ShieldCheck, UsersRound } from "lucide-react";

// The preview is illustrative; it never reads or changes workspace data.
const tasks = [
  { title: "طراحی صفحه‌های اصلی", tag: "طراحی", person: "نرگس", initial: "ن", date: "۱۲ آبان", tone: "sage", progress: 35 },
  { title: "پیاده‌سازی وب‌سایت", tag: "توسعه", person: "علی", initial: "ع", date: "۱۵ آبان", tone: "sand", progress: 65 },
  { title: "بررسی و تحویل نسخه", tag: "تحویل", person: "سارا", initial: "س", date: "۱۸ آبان", tone: "blue", progress: 90 },
];

function Foliage({ className = "" }: { className?: string }) {
  return <svg className={`shekof-foliage ${className}`} viewBox="0 0 160 330" fill="none" aria-hidden="true">
    <path d="M79 324C93 219 73 110 66 13" stroke="currentColor" strokeWidth="2" />
    {[0, 1, 2, 3, 4].map(i => <g key={i} transform={`translate(0 ${i * 53})`}>
      <path d="M72 78C34 65 17 42 12 18C48 26 67 44 72 78Z" fill="currentColor" opacity=".6" />
      <path d="M75 103C105 89 124 68 139 41C104 45 80 67 75 103Z" fill="currentColor" opacity=".8" />
      <path d="M72 78L24 32M75 103L126 54" stroke="currentColor" />
    </g>)}
  </svg>;
}

function Sketch({ kind = "board", className = "" }: { kind?: "board" | "calendar" | "target"; className?: string }) {
  return <svg className={`shekof-sketch ${className}`} viewBox="0 0 180 180" fill="none" aria-hidden="true">
    <circle cx="90" cy="96" r="69" className="sketch-disc" />
    <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {kind === "board" ? <g transform="rotate(-12 90 90)">
        <path d="M45 32L130 34L139 152L43 151Z" fill="var(--sketch-fill)" strokeWidth="3" /><path d="M48 40L124 41L132 143L50 143Z" />
        <path d="M66 24L105 25L108 44L63 44Z" fill="var(--sketch-fill)" /><path d="M79 25C78 11 95 11 95 25" />
        <path d="M59 67L66 74L80 58M59 98L66 105L80 89M59 128L66 135L80 119" strokeWidth="3" />
        <path d="M89 65L117 66M89 73L109 74M88 97L118 98M89 105L111 105M89 128L120 128M137 40L157 24M139 51L168 47M131 28L136 12M27 116L22 145L33 154" />
      </g> : kind === "calendar" ? <g transform="rotate(10 90 90)">
        <path d="M30 50Q29 42 38 41L140 38Q149 38 150 48L151 141Q150 149 140 149L40 152Q31 153 31 141Z" fill="var(--sketch-fill)" strokeWidth="3" />
        <path d="M35 73L146 70M58 28L58 54M120 27L120 52" strokeWidth="3" />
        {[0, 1, 2].map(y => [0, 1, 2, 3].map(x => <rect key={`${x}-${y}`} x={49 + x * 23} y={86 + y * 21} width="7" height="7" rx="1" />))}
        <circle cx="117" cy="111" r="17" fill="var(--sketch-fill)" /><path d="M108 111L114 118L126 104" strokeWidth="3" /><path d="M18 63L8 57M22 53L15 42M154 130L164 139M156 119L171 122" />
      </g> : <g>
        <ellipse cx="85" cy="99" rx="57" ry="61" transform="rotate(-17 85 99)" strokeWidth="3" /><ellipse cx="85" cy="99" rx="41" ry="45" transform="rotate(-17 85 99)" /><ellipse cx="85" cy="99" rx="24" ry="27" transform="rotate(-17 85 99)" />
        <path d="M72 97L82 109L103 83" strokeWidth="4" /><path d="M96 87L153 28M137 44L139 23L166 10L157 37L137 44ZM139 44L164 36M146 35L151 21M24 85C14 48 36 25 75 24M19 102L7 111M29 153L18 165M141 129L157 134M140 142L150 155" />
      </g>}
    </g>
  </svg>;
}

function ProductPreview() {
  const [view, setView] = useState("board");
  const views = [{ id: "board", label: "برد تسک‌ها", icon: FolderKanban }, { id: "timeline", label: "زمان‌بندی", icon: CalendarDays }, { id: "chat", label: "گفتگوی تیم", icon: MessageCircle }];
  return <div className="shekof-preview" id="product" aria-label="پیش‌نمایش تعاملی محصول با اطلاعات نمونه">
    <aside className="preview-sidebar" aria-label="نماهای پیش‌نمایش">
      <div className="preview-brand"><img src="/images/shekof-logo.svg" alt="" width="31" height="31" /><strong>پروژه‌های شکف</strong></div>
      <span className="preview-workspace"><span>ش</span>استودیو طراحی شکف</span>
      <span className="preview-nav-static"><LayoutDashboard size={15} />نمای کلی</span>
      {views.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`preview-nav ${view === id ? "active" : ""}`}><Icon size={15} />{label}</button>)}
      <span className="preview-nav-static"><UsersRound size={15} />اعضای تیم</span><span className="preview-nav-static preview-settings"><Settings2 size={15} />تنظیمات فضای کار</span>
    </aside>
    <div className="preview-content">
      <div className="preview-heading"><span><small>فضای کار / پروژه‌ها</small><strong>بازطراحی وب‌سایت</strong></span><span className="preview-search"><Search size={13} />جست‌وجو…</span></div>
      <div className="preview-overview"><div><span className="preview-live-dot" />پروژه در حال انجام است<small>قدم‌به‌قدم، تا یک نتیجهٔ مشترک</small></div><div className="preview-avatars"><b>ن</b><b>ع</b><b>س</b><span>۳ همکار</span></div></div>
      <div className="preview-metrics"><div><ListTodo size={18} /><span>تسک‌های پروژه<strong>۱۲ <small>تسک</small></strong></span></div><div><CheckCheck size={18} /><span>تکمیل‌شده<strong>۸ <small>تسک</small></strong></span></div><div><CalendarDays size={18} /><span>موعد تحویل<strong>۱۸ <small>آبان</small></strong></span></div></div>
      <div className="preview-view-heading"><strong>{views.find(item => item.id === view)?.label}</strong><span>نمونهٔ نمای محصول</span></div>
      <div className="preview-view" aria-live="polite">
        {view === "board" && <div className="preview-board">{tasks.map((task, i) => <div className="preview-column" key={task.title}>
          <div className="preview-column-heading"><i data-tone={task.tone} />{["برای شروع", "در حال انجام", "آمادهٔ بررسی"][i]}<span>۱</span></div>
          <article className="preview-task"><div><span className="preview-tag" data-tone={task.tone}>{task.tag}</span><MoreHorizontal size={14} /></div><h3>{task.title}</h3><p>پروژهٔ بازطراحی وب‌سایت</p><div className="preview-task-progress"><span style={{ width: `${task.progress}%` }} /></div><footer><span><b data-tone={task.tone}>{task.initial}</b>{task.person}</span><span><Clock3 size={10} />{task.date}</span></footer></article><span className="preview-add">+ افزودن تسک</span>
        </div>)}</div>}
        {view === "timeline" && <div className="preview-timeline"><div className="timeline-days"><strong>آبان ۱۴۰۵</strong>{["۱۰", "۱۲", "۱۴", "۱۶", "۱۸"].map(day => <span key={day}>{day}</span>)}</div>{tasks.map((task, i) => <div className="timeline-row" key={task.title}><span>{task.title}</span><div><span data-tone={task.tone} style={{ marginInlineStart: `${i * 24}%`, width: "44%" }}>{task.person}</span></div></div>)}</div>}
        {view === "chat" && <div className="preview-chat"><div><b>نرگس · طراح</b><p>نسخهٔ جدید طراحی آماده‌ست. نظرتون رو همین‌جا بنویسید.</p><span><Paperclip size={13} />طرح صفحات اصلی · نسخهٔ ۲</span></div><div><b>سارا · مدیر پروژه</b><p>بررسی شد؛ بعد از اصلاح صفحهٔ تماس، آمادهٔ تحویله.</p><small><CheckCheck size={12} />گفتگوی نمونهٔ تیم</small></div></div>}
      </div>
      <div className="preview-bottom"><span><ShieldCheck size={12} />یک فضای مشترک، برای تمام مسیر</span><span>آخرین به‌روزرسانی: همین حالا</span></div>
    </div>
  </div>;
}

const faqs = [
  ["مدیریت پروژه شکف برای چه تیم‌هایی مناسب است؟", "برای تیم‌هایی که می‌خواهند پروژه‌ها، تسک‌ها، گفتگوها و فایل‌هایشان را در یک فضای مشترک نگه دارند؛ از استودیوهای طراحی و تیم‌های توسعه تا تیم‌های اجرایی سازمان‌ها."],
  ["می‌توانم مشتری را هم به پروژه دعوت کنم؟", "بله. با نقش مهمان و دسترسی مشخص به پروژه، مشتری می‌تواند نسخه‌های قابل مشاهده را بررسی کند، بازخورد بدهد و تأیید یا درخواست اصلاح ثبت کند."],
  ["تاریخ‌ها و برنامه‌ریزی به تقویم شمسی هستند؟", "بله. تاریخ‌ها، انتخابگر تاریخ، تقویم کارها و زمان‌بندی پروژه از تقویم شمسی پشتیبانی می‌کنند."],
  ["امکان نصب روی سرور سازمان وجود دارد؟", "بله. می‌توانید نسخهٔ قابل نصب را با پایگاه‌داده و فایل‌های مستقل روی زیرساخت سازمان داشته باشید. برای هماهنگی نصب و پشتیبانی، از صفحهٔ تماس درخواست ثبت کنید."],
  ["روی موبایل هم می‌توانم از نرم‌افزار استفاده کنم؟", "بله. از مرورگر موبایل، تبلت یا کامپیوتر وارد فضای کار شوید. صفحه‌ها با اندازهٔ دستگاه شما هماهنگ می‌شوند."],
];

export default function LandingHome({ start }: { start: string }) {
  const [deployment, setDeployment] = useState<"hosted" | "self_hosted">("hosted");
  const hosted = deployment === "hosted";
  return <div className="landing-home">
    <section className="shekof-hero" aria-labelledby="landing-title">
      <div className="hero-atmosphere" aria-hidden="true" />
      <div className="landing-container hero-heading"><span className="landing-eyebrow"><i />کار روشن‌تر، همکاری نزدیک‌تر</span><h1 id="landing-title">کارها را <em>روشن‌تر ببین.</em><br />با هم، جلوتر برو.</h1><p>پروژه‌ها، تسک‌ها و گفتگوی تیمت را یک‌جا داشته باش؛ از اولین ایده تا آخرین تحویل.</p><div className="landing-actions"><a className="landing-button" href={start}>شروع همکاری<ArrowUpLeft size={18} /></a><a className="landing-watch" href="#product"><CirclePlay size={32} strokeWidth={1} />یک نگاه به شکف</a></div></div>
      <div className="landing-container hero-scene"><div className="scene-orbit" aria-hidden="true" /><Foliage className="hero-foliage-right" /><Foliage className="hero-foliage-left" /><Sketch className="hero-sketch-board" /><Sketch kind="calendar" className="hero-sketch-calendar" /><Sketch kind="target" className="hero-sketch-target" /><div className="hero-progress-widget" aria-hidden="true"><span>قدم‌های این هفته<ArrowUpLeft size={13} /></span><strong>۸ کار، انجام شد.</strong><small>هر روز، یک قدم جلوتر</small><div>{[20, 31, 25, 43, 51, 64, 76, 90].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div></div><ProductPreview /></div>
      <a className="hero-scroll" href="#features"><ArrowDown size={28} strokeWidth={1} /><span>همراه روزهای کاری تو</span></a>
    </section>
    <section id="features" className="landing-container shekof-features">
      <div className="section-heading"><h2>از پراکندگی کارها<br /><em>به یک مسیر روشن.</em></h2><p>بدان هر کار کجای مسیر است، چه کسی همراه آن است<br />و چقدر تا تحویل بعدی فاصله داری.</p></div>
      <div className="shekof-feature-grid">
        <article className="shekof-feature"><span className="feature-number">۰۱</span><div className="feature-copy"><h3>پروژه‌ها، یک‌جا</h3><p>تسک‌ها، اعضا و فایل‌های هر پروژه را در یک فضای منظم کنار هم ببین.</p></div><Sketch /><div className="feature-projects"><span><FolderKanban size={15} />بازطراحی وب‌سایت<b>۸ / ۱۲</b></span><span><FolderKanban size={15} />کمپین پاییز<b>۵ / ۸</b></span></div></article>
        <article className="shekof-feature"><span className="feature-number">۰۲</span><div className="feature-copy"><h3>زمان، قابل برنامه‌ریزی</h3><p>مسئول و موعد هر کار را مشخص کن و جریان پیشرفت تیم را دنبال کن.</p></div><Sketch kind="calendar" /><div className="feature-progress"><span>پیشرفت پروژه<strong>۶۸٪</strong></span><div><i style={{ width: "68%" }} /></div></div></article>
        <article className="shekof-feature"><span className="feature-number">۰۳</span><div className="feature-copy"><h3>تحویل‌ها، روشن‌تر</h3><p>نسخه‌ها، بازخوردها و تأیید مشتری را کنار همان کار نگه دار.</p></div><Sketch kind="target" /><div className="feature-approval"><FileCheck2 size={18} /><span>طرح نهایی وب‌سایت<small>نسخهٔ دوم · تأیید مشتری</small></span><Check size={17} /></div></article>
      </div><p className="sample-note">اطلاعات و پیشرفت‌های این صفحه، نمونه‌ای از نمای محصول هستند.</p>
    </section>
    <section id="deployment" className="shekof-spaces"><div className="landing-container">
      <div className="spaces-grid"><div className="spaces-copy"><span className="landing-eyebrow">برای هر شکل از همکاری</span><h2>تیم تو، فضای تو؛<br /><em>روی زیرساخت دلخواهت.</em></h2>
        <div className="space-switch" role="group" aria-label="انتخاب روش استقرار"><button type="button" aria-pressed={hosted} onClick={() => setDeployment("hosted")}>فضای میزبانی‌شده</button><button type="button" aria-pressed={!hosted} onClick={() => setDeployment("self_hosted")}>سرور سازمان</button></div>
        <div className="space-description" aria-live="polite"><p>{hosted ? "تیمت را دور یک میز مشترک جمع کن؛ بدون درگیر شدن با نصب و نگهداری نرم‌افزار." : "همان تجربهٔ همکاری، روی زیرساخت خودت؛ با پایگاه‌داده و فایل‌های مستقل برای سازمان."}</p><ul><li><Check size={16} />{hosted ? "فضای مستقل برای سازمان و اعضای تیم" : "داده‌ها و فایل‌ها روی زیرساخت سازمان"}</li><li><Check size={16} />{hosted ? "دعوت همکاران و تعیین دسترسی‌ها" : "نصب و پشتیبانی متناسب با نیاز تیم"}</li></ul><a className="space-start" href={`/contact?deployment=${deployment}`}>{hosted ? "دریافت پیشنهاد میزبانی" : "درخواست نصب روی سرور"}<ArrowLeft size={17} /></a></div>
      </div><div className="space-visual" aria-label={hosted ? "فضای مشترک تیم با پروژه‌ها، گفتگو و فایل" : "استقرار مستقل با داده‌ها و دسترسی سازمان"}>
        <Foliage /><svg className="space-connections" viewBox="0 0 500 360" fill="none" aria-hidden="true"><path d="M175 180C280 180 225 65 365 65M175 180C280 180 240 295 365 295" stroke="currentColor" strokeWidth="2" /><circle cx="365" cy="65" r="4" fill="currentColor" /><circle cx="365" cy="295" r="4" fill="currentColor" /></svg>
        <div className="space-node space-node-main">{hosted ? <Cloud size={26} /> : <Server size={26} />}<strong>{hosted ? "فضای کار تیم" : "سرور سازمان"}</strong><span>{hosted ? "همه کنار هم" : "زیرساخت مستقل"}</span></div>
        <div className="space-node space-node-top"><FolderKanban size={22} /><strong>{hosted ? "پروژه‌های مشترک" : "داده‌های سازمان"}</strong><span>{hosted ? "یک مسیر، یک تیم" : "در فضای خودت"}</span><i /></div>
        <div className="space-node space-node-bottom"><ShieldCheck size={22} /><strong>دسترسی‌های مشخص</strong><span>هر همکار، با نقش خودش</span><i /></div><Sketch kind={hosted ? "board" : "calendar"} />
      </div></div>
      <div className="shekof-steps">{[{ icon: FolderKanban, title: "فضای کارت را بساز", text: "پروژه، اعضا و مقصد مشترک تیم را مشخص کن." }, { icon: ListTodo, title: "کارها را به جریان بینداز", text: "تسک‌ها را واگذار کن و موعد هر قدم را بچین." }, { icon: FileCheck2, title: "با هم به نتیجه برسید", text: "نسخه‌ها را بررسی کن و نتیجه را تحویل بده." }].map(({ icon: Icon, title, text }, i) => <div key={title}><Icon size={23} /><span className="step-number">{["۱", "۲", "۳"][i]}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div>
    </div></section>
    <section id="faq" className="landing-container shekof-faq"><div className="faq-heading"><span className="landing-eyebrow">پیش از اولین قدم</span><h2>شاید سؤال تو هم باشد.</h2><p>شروع یک همکاری تازه،<br />از یک سؤال ساده می‌گذرد.</p><span className="faq-security"><ShieldCheck size={18} />اطلاعات تیم تو، در فضای خودت.</span></div><div className="faq-list">{faqs.map(([question, answer], i) => <details key={question} name="landing-faq" open={i === 0}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
    <section className="shekof-final"><div className="landing-container final-grid"><div><span className="landing-eyebrow">یک تیم، یک شروع تازه</span><h2>قدم بعدی تیمت را<br /><em>روشن بردار.</em></h2><p>از یک فضای مشترک، به یک نتیجهٔ مشترک برس.</p><a className="landing-button" href={start}>شروع همکاری با شکف<ArrowUpLeft size={18} /></a></div><div className="final-art"><Foliage /><Sketch kind="target" /></div></div></section>
  </div>;
}

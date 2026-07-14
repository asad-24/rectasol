import {
  AppWindow,
  BadgeCheck,
  BarChart3,
  Bot,
  Boxes,
  BrainCircuit,
  Brush,
  Building2,
  CalendarClock,
  CloudCog,
  Code2,
  Compass,
  DatabaseZap,
  Globe2,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Megaphone,
  MessageSquareText,
  MonitorCog,
  Rocket,
  SearchCheck,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  TestTube2,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type Service = {
  slug: string;
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  image: string;
  icon: LucideIcon;
  outcomes: string[];
  capabilities: string[];
  process: string[];
};

export type CaseStudy = {
  slug: string;
  title: string;
  category: string;
  description: string;
  image: string;
  galleryImages: string[];
  tags: string[];
  role: string;
  status: "Active" | "Concept" | "Archived";
  clientName: string;
  liveUrl?: string;
  impact: string[];
  overview: string[];
  challenge: string[];
  solution: string[];
  architecture: string[];
  features: Array<{
    title: string;
    description: string;
  }>;
};

export const navItems = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "About", href: "/about" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
];

export const stats = [
  { value: "40+", label: "service paths" },
  { value: "12", label: "delivery systems" },
  { value: "24h", label: "response window" },
  { value: "100%", label: "owner-led thinking" },
];

export const homeStats = [
  { value: 40, suffix: "+", label: "Service paths" },
  { value: 12, suffix: "+", label: "Product systems" },
  { value: 24, suffix: "h", label: "Response window" },
];

export const companyStats = [
  { value: 30, suffix: "+", label: "Build categories" },
  { value: 10, suffix: "+", label: "Tech domains" },
  { value: 6, suffix: "", label: "Delivery phases" },
  { value: 1, suffix: "", label: "Founder-led company" },
];

export const services: Service[] = [
  {
    slug: "web-applications",
    title: "Web Application Development",
    shortTitle: "Web Apps",
    eyebrow: "Fast product interfaces",
    description:
      "Modern business websites, dashboards, portals, and SaaS interfaces built with clean architecture, strong UX, and scalable frontend systems.",
    image: "/showcase/web-development.webp",
    icon: Globe2,
    outcomes: ["Conversion-ready pages", "Admin dashboards", "Secure customer portals"],
    capabilities: ["Next.js and React", "API integrations", "CMS-ready pages", "Performance tuning"],
    process: ["Map user journeys", "Design reusable components", "Build typed routes", "Optimize launch metrics"],
  },
  {
    slug: "mobile-apps",
    title: "Mobile App Development",
    shortTitle: "Mobile",
    eyebrow: "Pocket-ready products",
    description:
      "Cross-platform mobile apps for customer, staff, field, and marketplace workflows, designed for speed and daily use.",
    image: "/showcase/app-development.webp",
    icon: Smartphone,
    outcomes: ["iOS and Android apps", "Offline-friendly flows", "Push-ready product logic"],
    capabilities: ["React Native planning", "App UX systems", "Backend pairing", "Release guidance"],
    process: ["Define app jobs", "Prototype core screens", "Connect APIs", "Prepare store-ready builds"],
  },
  {
    slug: "ai-automation",
    title: "AI Automation & Agents",
    shortTitle: "AI Automation",
    eyebrow: "Useful intelligence",
    description:
      "AI workflows, internal agents, chat assistants, document pipelines, and automation layers that remove repeated manual work.",
    image: "/showcase/ai-automation.avif",
    icon: BrainCircuit,
    outcomes: ["AI assistants", "Document automation", "Operational copilots"],
    capabilities: ["LLM workflows", "RAG architecture", "Prompt systems", "Human review loops"],
    process: ["Identify repeatable tasks", "Design guardrails", "Integrate model workflows", "Measure time saved"],
  },
  {
    slug: "saas-platforms",
    title: "SaaS Platform Engineering",
    shortTitle: "SaaS",
    eyebrow: "Products that scale",
    description:
      "Subscription-ready platforms with authentication, roles, billing-ready data models, usage limits, dashboards, and admin controls.",
    image: "/showcase/software-development.webp",
    icon: AppWindow,
    outcomes: ["MVP to v1 roadmap", "Role-based access", "Operational admin panels"],
    capabilities: ["Product architecture", "Auth and permissions", "Database design", "Usage analytics"],
    process: ["Model the business", "Build core loops", "Add admin visibility", "Harden the release"],
  },
  {
    slug: "crm-erp-systems",
    title: "CRM, ERP & Workflow Systems",
    shortTitle: "CRM / ERP",
    eyebrow: "Operations with logic",
    description:
      "Custom internal systems for sales, inventory, support, finance, HR, procurement, and reporting workflows.",
    image: "/showcase/software-development.webp",
    icon: Workflow,
    outcomes: ["Cleaner operations", "Fewer spreadsheets", "Traceable approvals"],
    capabilities: ["Workflow mapping", "Data migrations", "Role dashboards", "Report automation"],
    process: ["Audit current work", "Design the source of truth", "Automate handoffs", "Train teams"],
  },
  {
    slug: "ecommerce-marketplaces",
    title: "E-commerce & Marketplace Builds",
    shortTitle: "Commerce",
    eyebrow: "Sell with structure",
    description:
      "Online stores, catalog systems, booking flows, multi-vendor concepts, payment-ready funnels, and conversion-focused product pages.",
    image: "/showcase/web-development.webp",
    icon: Boxes,
    outcomes: ["Storefronts", "Catalog logic", "Checkout-ready flows"],
    capabilities: ["Product modeling", "Payment planning", "Search and filters", "Order dashboards"],
    process: ["Shape the catalog", "Design buyer journeys", "Connect operations", "Improve conversion"],
  },
  {
    slug: "ui-ux-branding",
    title: "UI/UX, Branding & Design Systems",
    shortTitle: "Design",
    eyebrow: "Clarity people feel",
    description:
      "Interfaces, visual systems, brand direction, landing pages, prototypes, and component libraries that make products easier to trust.",
    image: "/showcase/ui-ux.webp",
    icon: Brush,
    outcomes: ["Design systems", "Clickable prototypes", "Brand-consistent UI"],
    capabilities: ["UX research", "Wireframes", "Design tokens", "Component libraries"],
    process: ["Clarify audience", "Prototype decisions", "Systemize visuals", "Hand off clean specs"],
  },
  {
    slug: "cloud-devops",
    title: "Cloud, DevOps & Infrastructure",
    shortTitle: "Cloud",
    eyebrow: "Reliable delivery",
    description:
      "Deployment pipelines, cloud architecture, monitoring, backups, environment strategy, and production hardening.",
    image: "/showcase/devops-cloud.webp",
    icon: CloudCog,
    outcomes: ["Stable releases", "CI/CD pipelines", "Observable systems"],
    capabilities: ["Vercel and cloud deploys", "Docker workflows", "Monitoring", "Backup planning"],
    process: ["Review environments", "Automate releases", "Add observability", "Document operations"],
  },
  {
    slug: "api-data-dashboards",
    title: "APIs, Integrations & Data Dashboards",
    shortTitle: "APIs & Data",
    eyebrow: "Systems that talk",
    description:
      "Typed APIs, third-party integrations, reporting layers, analytics dashboards, and data flows that make decisions easier.",
    image: "/showcase/software-development.webp",
    icon: DatabaseZap,
    outcomes: ["Reliable integrations", "Executive dashboards", "Data-backed decisions"],
    capabilities: ["REST and GraphQL", "CRM integrations", "Analytics models", "Export workflows"],
    process: ["Define source systems", "Design contracts", "Build dashboards", "Monitor data quality"],
  },
  {
    slug: "cybersecurity-maintenance-growth",
    title: "Security, Maintenance & Digital Growth",
    shortTitle: "Growth Care",
    eyebrow: "Long-term product health",
    description:
      "Security basics, maintenance retainers, SEO foundations, analytics, performance care, and growth experiments after launch.",
    image: "/showcase/software-development.webp",
    icon: ShieldCheck,
    outcomes: ["Safer products", "Faster pages", "Better growth loops"],
    capabilities: ["Security review", "Bug fixing", "SEO foundations", "Analytics events"],
    process: ["Audit risk", "Prioritize improvements", "Ship fixes", "Review monthly signals"],
  },
];

export const processSteps = [
  {
    title: "Diagnose",
    description: "We translate messy goals into a clear product map, risks, users, and measurable outcomes.",
    icon: MessageSquareText,
  },
  {
    title: "Design Logic",
    description: "We define data, flows, screens, roles, and integrations before the build becomes expensive.",
    icon: LayoutDashboard,
  },
  {
    title: "Build Smoothly",
    description: "We ship in clean increments with typed code, reusable components, and visible progress.",
    icon: Code2,
  },
  {
    title: "Launch & Improve",
    description: "We test, deploy, observe, and keep improving the product after real users touch it.",
    icon: Rocket,
  },
];

export const serviceProcess = [
  {
    step: "01",
    title: "Discovery",
    description: "Clarify goals, users, risks, existing systems, and the smallest useful release.",
    icon: SearchCheck,
  },
  {
    step: "02",
    title: "Strategy",
    description: "Turn business needs into a roadmap with priorities, milestones, and measurable outcomes.",
    icon: Compass,
  },
  {
    step: "03",
    title: "Design",
    description: "Map screens, roles, states, data, and interactions before heavy engineering starts.",
    icon: Brush,
  },
  {
    step: "04",
    title: "Development",
    description: "Build typed, maintainable software with reusable components and clean integrations.",
    icon: Code2,
  },
  {
    step: "05",
    title: "Testing",
    description: "Validate core workflows, edge cases, responsiveness, accessibility, and performance.",
    icon: TestTube2,
  },
  {
    step: "06",
    title: "Launch",
    description: "Deploy, monitor, improve, and plan the next meaningful iteration.",
    icon: Rocket,
  },
];

export const caseStudies: CaseStudy[] = [
  {
    slug: "hotel-operations-ai",
    title: "Hotel Operations AI Assistant",
    category: "AI / Hospitality",
    description:
      "A voice and workflow assistant concept for hotel reception, bookings, room service, complaints, and staff coordination.",
    image: "/showcase/htask-cover.webp",
    galleryImages: [
      "/showcase/htask-cover.webp",
      "/showcase/software-development.webp",
      "/showcase/ai-automation.avif",
    ],
    tags: ["AI", "Dashboard", "Automation", "Operations"],
    role: "AI Product Architecture",
    status: "Concept",
    clientName: "Hospitality operations",
    impact: ["Reduced repeated front-desk work", "Centralized guest requests", "Clearer operational reporting"],
    overview: [
      "This project pattern turns hotel operations into a more visible system across reception, room service, bookings, complaints, and internal follow-up.",
      "For RectaSol, the important idea is not only the assistant. It is the operational layer around the assistant: dashboard, audit trail, permissions, and staff handoff.",
    ],
    challenge: [
      "Hospital teams often handle requests across calls, paper notes, chat messages, and separate booking tools.",
      "An AI workflow must be useful without becoming risky, so human review, clear states, and escalation paths matter.",
    ],
    solution: [
      "Design an AI-assisted workflow where guest requests become structured tasks with owners, priorities, and status.",
      "Use dashboards and notification logic so staff can see what is open, delayed, resolved, or escalated.",
    ],
    architecture: [
      "Conversational intake connected to typed task creation.",
      "Operations dashboard with roles, status, and reporting.",
      "Human approval layer for sensitive or uncertain actions.",
    ],
    features: [
      { title: "Voice to task", description: "Guest or staff requests become structured operational tasks." },
      { title: "Role dashboards", description: "Reception, service, and management views stay focused on their work." },
      { title: "Escalation logic", description: "Delayed or sensitive requests can route to a human owner." },
    ],
  },
  {
    slug: "advisory-service-platform",
    title: "Advisory Service Platform",
    category: "Business Services",
    description:
      "A structured services website and inquiry system inspired by HMC-style service discovery, gated workflows, and lead routing.",
    image: "/showcase/hmc-holding.webp",
    galleryImages: [
      "/showcase/hmc-holding.webp",
      "/showcase/web-development.webp",
      "/showcase/software-development.webp",
    ],
    tags: ["Services", "Lead Flow", "SEO", "Forms"],
    role: "Service Platform Strategy",
    status: "Active",
    clientName: "Advisory services",
    impact: ["Improved service discovery", "Captured richer inquiry context", "Created scalable content paths"],
    overview: [
      "This pattern turns a complex services business into a clear digital journey with service discovery, structured inquiry capture, and conversion paths.",
      "RectaSol can reuse this logic for agencies, consultancies, clinics, real-estate groups, education providers, and B2B service companies.",
    ],
    challenge: [
      "Broad service businesses often overwhelm visitors with too many options and weak inquiry context.",
      "Teams need the website to capture what the visitor wants, not only name, email, and a generic message.",
    ],
    solution: [
      "Build category pages, service detail routes, contextual CTAs, and a form model that captures service, budget, timeline, and message.",
      "Create reusable content patterns so new services can be added without redesigning the whole site.",
    ],
    architecture: [
      "Next.js App Router pages for service discovery and landing content.",
      "Typed service data powering navigation, cards, details, and inquiry options.",
      "Validated contact API stub ready for SMTP or CRM integration.",
    ],
    features: [
      { title: "Service catalog", description: "Structured categories and detail pages reduce confusion." },
      { title: "Context-rich forms", description: "Inquiry data includes selected service, timeline, and project context." },
      { title: "SEO-ready content", description: "Pages are shaped for discoverability and future expansion." },
    ],
  },
  {
    slug: "property-investment-experience",
    title: "Property Investment Experience",
    category: "Real Estate",
    description:
      "A polished property and investment experience using premium motion, listing cards, mobile-first browsing, and conversion CTAs.",
    image: "/showcase/a2prop-cover.webp",
    galleryImages: [
      "/showcase/a2prop-cover.webp",
      "/showcase/web-development.webp",
      "/showcase/ui-ux.webp",
    ],
    tags: ["Real Estate", "Motion", "Listings", "UX"],
    role: "Frontend Experience Design",
    status: "Concept",
    clientName: "Property investment",
    impact: ["More engaging browsing", "Better mobile scanning", "Clearer investor calls to action"],
    overview: [
      "This project pattern focuses on premium presentation, mobile browsing, listing discovery, and investor-focused calls to action.",
      "The RectaSol lesson is that motion should help people scan and compare faster, not just decorate the page.",
    ],
    challenge: [
      "Property users need rich visuals, clear filters, and confident CTAs without feeling lost in a crowded listing experience.",
      "Premium motion must remain smooth on mobile and respectful of reduced-motion settings.",
    ],
    solution: [
      "Use strong listing cards, purposeful page transitions, mobile carousels, and conversion-focused inquiry flows.",
      "Keep asset rendering stable and page structure simple enough to expand into a map or CRM-backed inventory later.",
    ],
    architecture: [
      "Responsive listing UI with reusable cards and CTA modules.",
      "Media-first project presentation with gallery and detail content.",
      "Future-ready path for inventory APIs, maps, and lead routing.",
    ],
    features: [
      { title: "Premium cards", description: "Visual-first cards make high-value offers easier to inspect." },
      { title: "Mobile scanning", description: "Layouts prioritize fast browsing on small screens." },
      { title: "Lead path", description: "Each experience points users toward a focused next action." },
    ],
  },
];

export const projectFilters = ["All", ...Array.from(new Set(caseStudies.map((study) => study.category)))] as const;

export const techCategories = [
  {
    name: "Frontend",
    icon: Code2,
    color: "from-sky-400 to-blue-600",
    items: ["Next.js", "React", "TypeScript", "Tailwind", "Motion", "Shadcn"],
  },
  {
    name: "Backend",
    icon: DatabaseZap,
    color: "from-emerald-400 to-teal-700",
    items: ["Node.js", "NestJS", "PostgreSQL", "MongoDB", "REST", "GraphQL"],
  },
  {
    name: "AI / Data",
    icon: Bot,
    color: "from-violet-400 to-fuchsia-700",
    items: ["OpenAI", "RAG", "Agents", "Python", "Dashboards", "Automation"],
  },
  {
    name: "Launch",
    icon: CloudCog,
    color: "from-orange-400 to-red-600",
    items: ["Vercel", "AWS", "Docker", "CI/CD", "Monitoring", "Analytics"],
  },
];

export const testimonials = [
  {
    quote:
      "RectaSol feels like the kind of team that can turn a rough idea into a working system without losing the business logic.",
    name: "Operations Lead",
    role: "Hospitality platform",
  },
  {
    quote:
      "The focus is practical: clean UX, strong technical choices, and a roadmap that makes sense after launch.",
    name: "Founder",
    role: "B2B services company",
  },
  {
    quote:
      "The best part is that the product thinking and engineering thinking happen together, not in separate rooms.",
    name: "Product Owner",
    role: "SaaS workflow tool",
  },
];

export const faqs = [
  {
    question: "What does RectaSol build?",
    answer:
      "RectaSol builds websites, web apps, mobile apps, SaaS platforms, AI automations, CRM/ERP systems, dashboards, integrations, and long-term product improvements.",
  },
  {
    question: "Can RectaSol work from a rough idea?",
    answer:
      "Yes. The first step is to convert the idea into goals, users, flows, features, risks, and a practical release plan.",
  },
  {
    question: "Do you only build software?",
    answer:
      "Software is the core, but RectaSol also supports UI/UX, branding, cloud, automation, analytics, SEO foundations, maintenance, and digital growth.",
  },
  {
    question: "How does a project start?",
    answer:
      "Start with the project form. RectaSol reviews the need, asks sharp follow-up questions, and proposes a practical next step.",
  },
];

export const partnerLogos = [
  { name: "HotelsTask", src: "/partners/hotelstask.webp" },
  { name: "HMC Holdings", src: "/partners/hmc-holdings.webp" },
  { name: "SaitaReward", src: "/partners/saitareward.webp" },
];

export const values = [
  {
    title: "Logical first",
    description: "Every interface, workflow, and automation needs a reason to exist.",
    icon: BrainCircuit,
  },
  {
    title: "Smooth by default",
    description: "Performance, motion, and mobile behavior should feel calm and intentional.",
    icon: BadgeCheck,
  },
  {
    title: "Secure enough to grow",
    description: "Access, validation, data handling, and deployment choices are planned early.",
    icon: LockKeyhole,
  },
  {
    title: "Measured after launch",
    description: "Good products keep learning through analytics, feedback, and iteration.",
    icon: BarChart3,
  },
];

export const careerRoles = [
  "Frontend Engineer",
  "Full-stack Engineer",
  "UI/UX Designer",
  "AI Automation Builder",
  "Project Coordinator",
  "Digital Growth Specialist",
];

export const futureTeamRoles = [
  {
    name: "Asad",
    role: "Founder & Product Engineering Lead",
    bio: "Guides RectaSol around practical software, AI automation, interface quality, and long-term product logic.",
    expertise: ["Product logic", "Full-stack systems", "AI workflows"],
    icon: Sparkles,
  },
  {
    name: "Frontend Systems",
    role: "Experience Engineering",
    bio: "Future team lane for polished websites, dashboards, component systems, animation, and responsive interfaces.",
    expertise: ["Next.js", "UI systems", "Motion"],
    icon: MonitorCog,
  },
  {
    name: "Automation Studio",
    role: "AI & Workflow Delivery",
    bio: "Future lane for agents, internal tools, integrations, reporting workflows, and operations automation.",
    expertise: ["AI agents", "APIs", "Dashboards"],
    icon: Bot,
  },
];

export const benefits = [
  {
    title: "Flexible work",
    description: "Remote-friendly collaboration with clear outcomes, async notes, and focused build cycles.",
    icon: CalendarClock,
  },
  {
    title: "Learning culture",
    description: "Every project should improve the way the next system is designed, built, and launched.",
    icon: GraduationCap,
  },
  {
    title: "Ownership mindset",
    description: "Builders are trusted to understand the business reason behind the technical decision.",
    icon: Target,
  },
  {
    title: "Modern tooling",
    description: "RectaSol favors typed stacks, component systems, automation, and fast deployment paths.",
    icon: Code2,
  },
  {
    title: "Client clarity",
    description: "Progress is explained in plain language so stakeholders can make better decisions.",
    icon: MessageSquareText,
  },
  {
    title: "Sustainable pace",
    description: "The company is designed for dependable delivery, not chaotic last-minute heroics.",
    icon: HeartHandshake,
  },
];

export const growthChannels = [
  { label: "SEO-ready websites", icon: Megaphone },
  { label: "Dashboards and reporting", icon: BarChart3 },
  { label: "Automation workflows", icon: Workflow },
  { label: "Secure cloud launches", icon: ShieldCheck },
];

export const contactInfo = [
  {
    title: "Email",
    value: "hello@rectasol.com",
    details: ["Project inquiries", "Partnerships", "General questions"],
    href: "mailto:hello@rectasol.com",
    icon: Mail,
  },
  {
    title: "Founder",
    value: "Asad",
    details: ["Founder-led discovery", "Technical direction", "Product thinking"],
    href: "/about",
    icon: Users,
  },
  {
    title: "Location",
    value: "Remote-first",
    details: ["Pakistan-ready", "Global collaboration", "Async friendly"],
    href: "/contact",
    icon: Building2,
  },
  {
    title: "Response",
    value: "Within 24 hours",
    details: ["Project review", "Next-step proposal", "Scope questions"],
    href: "/contact",
    icon: CalendarClock,
  },
];

export const socialChannels = [
  {
    name: "LinkedIn",
    status: "Company profile coming soon",
    description: "For product notes, launch updates, and professional announcements.",
    icon: Globe2,
    gradient: "from-[#0a66c2] to-[#004182]",
  },
  {
    name: "GitHub",
    status: "Engineering presence coming soon",
    description: "For open-source utilities, examples, and developer-facing work.",
    icon: Code2,
    gradient: "from-[#24292f] to-[#57606a]",
  },
  {
    name: "Instagram",
    status: "Studio updates coming soon",
    description: "For visual progress, UI snapshots, and behind-the-scenes build notes.",
    icon: Sparkles,
    gradient: "from-[#f09433] via-[#dc2743] to-[#bc1888]",
  },
];

export const marqueeCopy =
  "Web apps / Mobile apps / AI automation / SaaS platforms / CRM systems / Cloud delivery / UI UX systems / Digital growth";

export const careerValues = [
  {
    title: "Innovation with a job to do",
    description: "New tools matter when they remove friction or create measurable value.",
  },
  {
    title: "Ownership culture",
    description: "Every role should understand the user's problem and the business context.",
  },
  {
    title: "Calm execution",
    description: "Good work is visible, documented, tested, and easy to continue.",
  },
  {
    title: "Respect for craft",
    description: "Design, code, copy, automation, and operations all deserve serious attention.",
  },
];

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}

export function getCaseStudy(slug: string) {
  return caseStudies.find((study) => study.slug === slug);
}

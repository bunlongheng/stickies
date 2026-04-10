import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job Skills Guide | Stickies",
  description:
    "Essential skills to develop when searching for a new job — technical, soft, and strategic skills to stand out in the job market.",
};

/* ── colour tokens (match the Stickies palette) ─────────── */
const COLORS = {
  yellow: "#FFCC00",
  orange: "#FF9500",
  blue: "#007AFF",
  green: "#34C759",
  pink: "#FF2D55",
  purple: "#AF52DE",
  teal: "#5AC8FA",
  red: "#FF3B30",
};

/* ── data ────────────────────────────────────────────────── */
interface Skill {
  icon: string;
  title: string;
  description: string;
  examples: string[];
}

interface SkillCategory {
  heading: string;
  color: string;
  skills: Skill[];
}

const CATEGORIES: SkillCategory[] = [
  {
    heading: "Technical Skills",
    color: COLORS.blue,
    skills: [
      {
        icon: "💻",
        title: "Programming & Software Development",
        description:
          "Modern employers value candidates who can code, automate workflows, or at least understand how software is built.",
        examples: [
          "Python, JavaScript, TypeScript",
          "SQL & database fundamentals",
          "Version control with Git & GitHub",
          "Cloud basics (AWS, GCP, or Azure)",
        ],
      },
      {
        icon: "📊",
        title: "Data Analysis & Visualization",
        description:
          "The ability to turn raw data into actionable insights is valued across nearly every industry.",
        examples: [
          "Excel / Google Sheets (pivot tables, VLOOKUP)",
          "BI tools like Tableau or Power BI",
          "Basic statistics & A/B testing",
          "Data cleaning & manipulation",
        ],
      },
      {
        icon: "🤖",
        title: "AI & Automation Literacy",
        description:
          "Understanding how to leverage AI tools and automation to multiply your productivity is now a must-have skill.",
        examples: [
          "Prompt engineering for LLMs",
          "Workflow automation (Zapier, Make, n8n)",
          "AI-assisted coding & writing",
          "Understanding ML concepts at a high level",
        ],
      },
      {
        icon: "🔒",
        title: "Cybersecurity Awareness",
        description:
          "Every company needs employees who understand security fundamentals and can protect digital assets.",
        examples: [
          "Password management & MFA",
          "Phishing & social engineering recognition",
          "Data privacy regulations (GDPR, CCPA)",
          "Secure coding practices",
        ],
      },
    ],
  },
  {
    heading: "Soft Skills",
    color: COLORS.green,
    skills: [
      {
        icon: "🗣️",
        title: "Communication",
        description:
          "Clear written and verbal communication is consistently ranked as the #1 skill employers seek.",
        examples: [
          "Concise email & Slack communication",
          "Presentation & public speaking",
          "Technical writing & documentation",
          "Active listening in meetings",
        ],
      },
      {
        icon: "🧩",
        title: "Problem Solving & Critical Thinking",
        description:
          "Employers need people who can break down complex problems, evaluate options, and make sound decisions.",
        examples: [
          "Root cause analysis",
          "Structured decision-making frameworks",
          "Creative brainstorming techniques",
          "Debugging & troubleshooting methodologies",
        ],
      },
      {
        icon: "🤝",
        title: "Collaboration & Teamwork",
        description:
          "Almost every role requires working with others. Knowing how to collaborate effectively is essential.",
        examples: [
          "Cross-functional team projects",
          "Conflict resolution & feedback",
          "Remote collaboration tools (Slack, Zoom, Notion)",
          "Pair programming / peer review",
        ],
      },
      {
        icon: "⏱️",
        title: "Time Management & Adaptability",
        description:
          "Being able to prioritize, meet deadlines, and adapt to changing requirements is critical in fast-paced environments.",
        examples: [
          "Task prioritization (Eisenhower matrix)",
          "Agile & Scrum methodologies",
          "Handling ambiguity & pivoting quickly",
          "Work-life balance & avoiding burnout",
        ],
      },
    ],
  },
  {
    heading: "Job Search Strategy Skills",
    color: COLORS.orange,
    skills: [
      {
        icon: "📝",
        title: "Resume & Portfolio Building",
        description:
          "Your resume and portfolio are your first impression. They need to be polished, relevant, and results-driven.",
        examples: [
          "Quantify achievements with metrics",
          "Tailor resume to each job description",
          "Build an online portfolio or GitHub profile",
          "Use action verbs & concise bullet points",
        ],
      },
      {
        icon: "🔗",
        title: "Networking & Personal Branding",
        description:
          "Many jobs are filled through referrals. Building a professional network and online presence opens doors.",
        examples: [
          "Optimize your LinkedIn profile",
          "Attend meetups, conferences & webinars",
          "Contribute to open-source projects",
          "Write blog posts or share knowledge online",
        ],
      },
      {
        icon: "🎯",
        title: "Interview Preparation",
        description:
          "Interviews test both your skills and how you present them. Preparation is the key differentiator.",
        examples: [
          "STAR method for behavioral questions",
          "Practice coding challenges (LeetCode, HackerRank)",
          "Research the company & role thoroughly",
          "Prepare thoughtful questions for interviewers",
        ],
      },
      {
        icon: "💰",
        title: "Salary Negotiation",
        description:
          "Negotiating your compensation can have a massive impact over your career. It is a learnable skill.",
        examples: [
          "Research market rates (levels.fyi, Glassdoor)",
          "Practice negotiation conversations",
          "Understand total compensation (equity, benefits)",
          "Know when & how to make a counter-offer",
        ],
      },
    ],
  },
  {
    heading: "Growth Mindset Skills",
    color: COLORS.purple,
    skills: [
      {
        icon: "📚",
        title: "Continuous Learning",
        description:
          "Technology and industries evolve fast. Committing to lifelong learning keeps you relevant and competitive.",
        examples: [
          "Online courses (Coursera, Udemy, edX)",
          "Professional certifications",
          "Reading industry blogs & newsletters",
          "Side projects & experimentation",
        ],
      },
      {
        icon: "🌱",
        title: "Emotional Intelligence",
        description:
          "Self-awareness, empathy, and the ability to manage your emotions are powerful workplace advantages.",
        examples: [
          "Self-reflection & journaling",
          "Giving and receiving constructive feedback",
          "Managing stress & staying composed",
          "Understanding team dynamics",
        ],
      },
    ],
  },
];

/* ── component ───────────────────────────────────────────── */
export default function JobSkillsGuidePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ── hero ─────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-white/10">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(ellipse at 30% 20%, ${COLORS.yellow}33 0%, transparent 60%),
                         radial-gradient(ellipse at 70% 80%, ${COLORS.blue}22 0%, transparent 60%)`,
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 py-16 sm:py-24 text-center">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl text-4xl"
            style={{
              background: `linear-gradient(135deg, ${COLORS.yellow}, ${COLORS.orange})`,
              boxShadow: `0 8px 32px ${COLORS.yellow}40`,
            }}
          >
            🚀
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Job Skills Guide
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
            The essential skills you should develop when searching for a new
            job&nbsp;&mdash; from technical know-how and soft skills to
            interview strategy and career growth.
          </p>
        </div>
      </header>

      {/* ── body ─────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {CATEGORIES.map((cat) => (
          <section key={cat.heading} className="mb-16">
            <h2
              className="mb-8 text-2xl font-bold tracking-tight"
              style={{ color: cat.color }}
            >
              {cat.heading}
            </h2>

            <div className="grid gap-6 sm:grid-cols-2">
              {cat.skills.map((skill) => (
                <article
                  key={skill.title}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-2xl">{skill.icon}</span>
                    <h3 className="text-lg font-semibold">{skill.title}</h3>
                  </div>
                  <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                    {skill.description}
                  </p>
                  <ul className="space-y-1.5">
                    {skill.examples.map((ex) => (
                      <li
                        key={ex}
                        className="flex items-start gap-2 text-sm text-zinc-300"
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                          style={{ background: cat.color }}
                        />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* ── quick-start checklist ──────────────────────── */}
        <section className="mb-16 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">
            Quick-Start Checklist
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Update your resume with quantified achievements",
              "Polish your LinkedIn & online profiles",
              "Learn or refresh one in-demand technical skill",
              "Practice behavioral interview questions (STAR method)",
              "Set up job alerts on 3-5 platforms",
              "Build or update your portfolio / GitHub",
              "Research salary ranges for your target roles",
              "Reach out to 5 people in your network this week",
            ].map((item) => (
              <label
                key={item}
                className="flex items-start gap-3 rounded-lg p-2 text-sm text-zinc-300 hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-zinc-600 accent-yellow-400"
                />
                {item}
              </label>
            ))}
          </div>
        </section>

        {/* ── footer CTA ─────────────────────────────────── */}
        <div className="text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            style={{
              background: `linear-gradient(135deg, ${COLORS.yellow}, ${COLORS.orange})`,
            }}
          >
            Open Stickies to take notes
          </a>
          <p className="mt-3 text-xs text-zinc-500">
            Use Stickies to track your job search progress, save interview
            notes, and organize your applications.
          </p>
        </div>
      </main>
    </div>
  );
}

# VISION BRIEF — Sifarish (v2)
From: Shaurya (Showie), founder · To: the studio team (Claude Code + studio-* skills)
Captured 5 September 2026

**This brief REPLACES `VISION-BRIEF-sifarish.md` (30 Aug 2026) completely.** That brief is
void. Do not read it, do not reconcile against it, do not treat anything in it as a decision
already made. Several of its lines are the direct cause of what the founder is unhappy about
today — they are named and retracted in the RE-BRIEF sections below so they cannot be
inherited by accident.

---

## READ THIS FIRST — instructions for the team

This is my intent and my constraints. It is NOT a spec, NOT a stack choice, NOT a design,
NOT a feature list. Run your own full pipeline starting from research:

1. `studio-recon` — research this domain live, all the way down to the real user and the real
   situation: what a genuinely strong CSE/AI-engineer résumé actually looks like in 2026, how
   real ATS parsers behave, how recruiters at AI-native startups actually read, how job boards
   and aggregators actually expose fresh roles. Assume nothing below is complete.
2. `studio-boardroom` — debate features and pick the pillars yourselves. I have not
   pre-selected them. He has described *outcomes and behaviours*, not modules.
3. `studio-architecture` — choose and lock the stack yourselves, live-verified.
4. `studio-constitution` → `studio-arcs` — set up the project and plan the build.
5. Build in arcs, closing each with `studio-verify`, following the Autonomy Charter below.
6. **Verify by watching it work, not by watching tests pass.** Use browser control on the live
   app. Generate a real résumé from a real job post and read it as a recruiter would. A green
   test suite is not evidence that this résumé gets a human to pick up a phone.

He has asked, explicitly and repeatedly, that **every single skill in the arsenal be used** on
this project. His words: *"I want it to use every fucking skill in the arsenal it literally has
many , sab use karre har ek skill."* Take that as an instruction about thoroughness — do not
shortcut the pipeline because the project already exists.

---

## THE DREAM

Sifarish is **a team of personal agents whose entire working life has been dedicated to getting
a student selected at the place where their heart belongs.** Not a résumé generator. A team.

In his own words, unedited:

> "I need an app that acts like a super efficient , wise , highly experienced team of personal
> agents , whose whole life has been dedicated to getting students selected at the places where
> their heart belongs , they make ensure the student gets to showcase their skill in the
> interviews , or directly at the job , meaning the resume should get them a call at any cost ,
> must work upon every bit of information they will be getting about the company"

> "jo jo ek personal agent karta hai I want har cheez ye app kar sake , like sab manage karna ,
> dekh paana , data hold karna , changes karna karwana , mudustry ki khabar , voh mere liye
> kaise useful hogi , resume generation , company ke baare mein detailed research, mere ko
> analyze karna , company ke hisab se dhalna , maximum ability pe leke jaana har cheez ko"

> "ek secretary ceo ke liye har cheez manage karke rakhti hai , and make sure karti hai ceo ko
> vo mile jo voh chahte hain at any cost"

> "I want every single thing that a highly skilled and cunning team would do be done by this
> app"

> "jo jo nhi kar sakte tujhe har cheez karni hai , that too unse 100 gunna better usmein"

### The single word that carries the most intent: **chalaak**

This is the thing the previous build missed hardest, and he says it more times than anything
else. He does not want a correct résumé. He wants a **shrewd** one — one built by something
with a mind, that reasons about who is reading it and why.

> "I want sifarish to act like a shaatir and chalaak strategist .. bahut chalaak and wise , ki
> saari knowledge hai"

> "bahut zyada intelligent ho yaar editor mera literally bahut bahut zyada intelligent , like
> chalaak bhi , chalaki maarni ache se aati ho"

> "resume bahut zyada chalaki se banaye jaye"

> "we have to give my resume a super stong personality and editor tailor etc a super iq chalaak
> brain"

> "smart log rules se upar jaate hain"

> "soch matter karti hai"

> "carefully jaise team of personal agents kaam kar rhi hain for weeks on a certain thing the
> app has to think like that"

> "resume bahut strategically tailor hon , like jaise kisi actual dimag wale bande ne kaam kiya
> hai , ek ek cheez soch ke , tark karke , evaluate karke"

**What chalaak means, in his own worked example** (this is the highest-signal paragraph in this
document — read it twice):

> "if akal hoti toh ntse ko proper badha chadha ke bataya jaata , braillix mein innovation wali
> side ko meri highlight kiya jaata , achievements mein sirf ek IIT hackathon ka zikar na hota ,
> skills mein ye cheez alag se mention hoti , bahut kuch ho sakta tha"

> "ye nhi ai company hai toh ai wale project dekho rag kidhar aa rha ye voh , ecommerce hai hmm
> iske regarding project daalo , hmm company aisi hai ye daalo hmmm"

> "babaclick was not a normal company , kyunki vahaan hatke jaake alag cheezein ntse etc
> highlight karna tha , total framing different jaani thi"

So: reframing is not decoration. For a company that says *"we do not care about your
university's brand, your degree subject, LeetCode, certificates"* and cares about
*"logical reasoning, intellectual honesty, quantitative comfort, personal agency"* — the
correct move was to lead with NTSE (national-level aptitude, proven), with Braillix's
innovation angle, with everything that proves a mind. Instead the app pulled tech skills off
the JD keyword-style and shipped. That is the failure in one sentence.

### Data is gold

> "data is gold its money , jitna data provide kiya jaata hai saare ko ache se samjhna uspe
> work karna bahut zaruri hai"

He will feed it a lot: full job posts (not just the JD — the whole page, company blurb,
culture section, hiring philosophy, everything), his project READMEs, sample résumés. The
standard is that **every scrap of that is reasoned over**, not keyword-matched.

> "poori detailed company info pe act karne ki taakat ho meri app ke paas"

> "ye jo bhi info main launga uspe best kaam ho"

> "other than just the jd , how much key info babaclick held"

### His projects, and their READMEs

> "I want sifarish to have deep readme knowledge of every project because mujhe pata hai main
> apne har project ki kaamaal ki readme banata hun , so bahut kamaal ki readme hain , unhe
> deeply padhe and fir company ki information jo bahut detailed dunga main uske basis pe resume
> banaye mera"

He is proud of his READMEs and considers them a genuine asset. Whatever the app knows about
his projects should come from reading those in depth — not from a hand-typed summary he has to
maintain.

### Self-evolving, built on real data

> "builds me an app that stands against the test of time , self evolves , built upon loads and
> loads of data , that data as well evolves , like for example , resume builder has studied
> thoudands of real cse resumes , adn naya kuch aata hai market mein it adapts to it yes .. main
> bhi claude code mein sample resumes upload karunga bachon ke kafi saare right , unhe study
> karre aur genuine resume banaye"

He will upload real student résumés at session start. He expects the app to have actually
studied real résumés — his friends' ones are LaTeX, wider, longer, and beat his by a distance.

> "bencho kya chote chote resume se banata rehta hai sifairsh bencho actual format pe gya hi
> nhi ye sabse badi nalaaki hai meri sifarish ki"

### Talk to it like you talk to your team

> "mere liye koi bhi kisi bhi cheez mein jaisa marzi change karwana bass baat karne jaisa ho ,
> like we talk to personal agents , yahaan do this yahaan ye"

> "app mein koi bhi change karni ho baat karke karwa skaun like koi bhi idea execute karwana ho
> apna you just have to talk to the team"

> "har feature ho jisse mera experience usse baat karne jitna asaan ho"

> "app ke kisi bhi point pe kuch bhi change karwana halwa ho mere liye , like kahin bhi kuch bhi"

### Everything in front of his eyes

> "mujhe abhi har application ka kya status chal rha gmail ke through ek ek cheez batana , taki
> har cheez aankhon ke saamne ho"

> "har cheez manage and track ho sake , like actual mein hota hai jaise"

> "gmail se sab data utha sake , linkedin pe hi reply aate companies ke , ye babaclick ki
> rejection bhi jaise udhar aayi"

Note for the team: **the previous brief killed "analytics-dashboard type things" and that kill
is now void.** See the retraction list below. He wants visibility.

### Why this matters to him

> "mereko bass chahiye ye meri selection sure karre and iske end pe kisi bhi galti ke karan bass
> main reh na jaun"

> "I dont want ye app meri dream oppurtunity ya kisi bhi cheez ke beechmein aa jaye"

> "kyunki mere mein dum hai , atleast chance milta na main fight karta bhale reject hota"

> "all I want is a chance to fight"

> "teri ek duty thi , mujhe interview call dilwana , aage toh ofcourse meri skills aur mehnat
> hoti hamesha"

That last line is the whole contract. **The app's job ends at the interview call. Everything
after that is his.** Build for that one handoff.

---

## THE ACCEPTANCE SCENE

Shaurya pastes the entire Babaclick job post — not just the JD, the whole page including the
"we don't care about X, we care enormously about Y" section — into Sifarish, and the résumé it
returns is one that leads with his NTSE scholarship and Braillix's innovation, carries every
achievement he has, links out to live work, reads like a sharp human spent a week on it, and
gets him an interview call instead of the LinkedIn rejection email he actually received.

**Important scoping note from him:** Babaclick is the worked example because it is the one that
hurt and the one with rich public context — *"babaclick ki examples de rha hun because thats
very crucial but aisa mat samjhna ki only thats the type of role I am interested in."* He is
applying across many AI-adjacent role types. The app must reshape itself for each. Do not
overfit the product to vibe-coder / growth-intern postings.

---

## SUCCESS, IN HIS WORDS

> "in the end I want an app jo make sure karre ki I get an interview call , or like mujhe meri
> skills showcase karne ka mauka mile"

> "an app that acts like a super efficient , wise , highly experienced team of personal agents"

And the release condition, which matters as much as the product:

> "also this is the last time any change to the app should be made , main nhi stress carry kar
> sakta app ka , jab tak lagega ismein kami hai nhi apply kar paunga kidhar bhi"

> "I want to do it without anything being going on in my mind , because dekho if mere mind mein
> ye rahega ki this app can be better , or something is missing there will always be some kind
> of hesitation inside me and I dont want that , that way I wont able to apply to the amount of
> companies jitni mein main karna chahta hun apply"

**Read that as a hard requirement on the team, not as sentiment.** He has stopped applying
while this is unresolved, and applying is the actual goal. Every day this build runs is a day
of applications not sent. Optimise the arc plan so that a *usable, trustworthy* résumé path
exists as early as possible, and everything else grows around it — do not leave him waiting on
a grand finish. The clock is a real cost, not a background variable.

**His deadline context (from his own stated plan, correct him if it has moved):** the
8th-semester internship is compulsory and starts January 2027; he wants it secured by end of
November 2026; December is taken by end-semester exams. October–November is the applying
window. That is the clock.

---

## WHO TOUCHES IT

- **Audience: only him.** Plus a demo mode for strangers — specifically recruiters and people
  looking at his GitHub.
- **Demo mode requirements, his words:** *"demo mode meri info leak na ho , sirf main as a owner
  api use kar sakun , haan but ofcourse jaise recruiter kholenge if project unhe bhi demo mode
  mein cheezein samjh aa jayein dikhein"* — his personal data must not leak, his API keys/quota
  must be usable only by him as owner, and a visitor must still be able to *understand what it
  does and how*, and be impressed.
- **Usability floor:** himself, and a recruiter with no context who opens the link once. If a
  recruiter cannot tell what this is within a few seconds of landing, demo mode has failed.
- **Data sensitivity: his own private data only** — résumés, GitHub, Gmail, application history,
  and detailed company research he pastes in.
- **GitHub, his words:** *"github jab update karoge mera toh add screenshots too there app ke"* —
  when the repo is updated, put app screenshots in it.

---

## BOUNDARIES HE DREW

**Matters most** — he refused, again, to reduce this to a short list, and that refusal is
itself the instruction:

> "dekho features wagara har cheez skills in claude code decide karenge , but main point is
> purane kisi feature ka zyada voh nhi lena , shuru se apna sochna hai nya bilkul"

The one non-negotiable outcome, stated many ways: **the résumé must get him an interview call.**
Derive your own pillar order in boardroom and log the reasoning in DECISIONS.md. Do not ask him
to pick three.

**Kill list — what must not exist in the next version** (all his own, verbatim or near):

- **AI slop, anywhere.** *"no ai slop will be tolerated at any place in the app"*, *"headline tak
  itni ai generated lagti hai , ai slop pure"*, *"right now the headline and various other things
  that are newly generated with every role are so ai slop I cant even say."*
- **A maintained skills list in the Ledger.** *"jo skills added hain in ledger itni fuddu si hain
  , whsiper ai kaun dalta hai ?"*, *"ledger ka skill section is just a waste of time and effort"*,
  *"voh skills in ledger maintain karna seems crap."* His replacement instruction: *"buddy tu jd
  ke hisab se khud daaldiya kar skills , har company ke liye naya resume banega , jo company ko
  chaiye daalo na"*, *"industry ke hisab se jo company ki requirement hai banao vaise resume aap
  na"*, *"jd wali skills daala karo."* **He has almost all agentic-AI skills now** — *"mere paas
  agentic ai wali almost saari hain ab"* — so the honesty constraint is not the binding one here;
  the app's unwillingness to put true, relevant skills on the page is.
- **Small résumés.** *"ats ya jo bhi score hota hai maximum ho"*, *"I want exactly vaise bannein
  jaise chalte hain , koi kanjoosi na ho unmein thode bade honge tab bhi chalega"*, *"ek dum bade
  bade genuine size ke banein resume."*
- **Achievements being silently dropped.** *"meri 3 4 achievements hone ke baawjud voh sirf 2
  rakhta hai."*
- **Résumés with no hyperlinks.** *"also the resumes dont have hyperlinks , buddy , I dont
  understand did claude code even search the latest stuff ??"*
- **A slow editor.** *"editor bhi faltu ka zyada time na le"*, *"load hone mein time lag rha kaise
  kya problem solve hogi etc sab aise socho like real companies move buddy."*
- **Wasted API calls.** *"kam se kam api cost mein best se best kaam , like karre api use bass
  faltu mein nhi."* (See the standards section — this must not become an excuse for shallow work.)
- **Stale and misranked job results.** See the symptom log below.

**RETRACTED FROM THE PREVIOUS BRIEF — do not inherit:**

- *"Explicitly not-now: mobile app, multi-user, analytics-dashboard type things."* All three of
  those came from a multiple-choice menu the intake offered him, not from him. **That entire
  not-now list is void.** In particular he now explicitly wants *"har cheez aankhon ke saamne"* —
  full visibility of every application's status — and a demo mode that strangers open, which is
  a form of multi-user. Decide these yourselves from scratch.
- *"It must never invent anything."* Written as an absolute gate, it produced an app that
  suppresses true, provable, relevant claims. The correct standard is in the next section and it
  is not a weaker one — it is a harder one.
- *"Money: free tier only. No paid spend."* and *"Time shape: fast."* — both were written as
  top-level laws with no quality floor beside them. Read the standards section instead.

---

## CONSTRAINTS ONLY HE KNOWS

- **Money.** His words: *"itni toh keys dedi"* and *"I am willing to give any other free api jo
  bhi isko chahiye , main ready hun dene ke liye , bass start mein maangle taki claude code kaam
  karta rhe fir main apna unbothered padhta rhun."* So: ask for every credential you will need in
  **one message at the very start**, with exact baby-step instructions for where to get each one,
  then do not come back for more. He is a student; default to free tiers. But see the standards
  section — if free tiers physically cannot carry the depth the product needs, that is an
  escalation with INR-costed options, not a silent downgrade.
- **Existing assets in hand:**
  - The **Sifarish repo** — `https://github.com/SHV27/sifarish`, live at
    `https://sifarish-shv-s-projects.vercel.app`. Roughly a month of prior work. Changes go into
    **this same repo** (his prior standing instruction; he has not revoked it).
  - His **GitHub project READMEs** — he considers these excellent and wants them read deeply.
    Named projects: Braillix, Sehat Saarthi, Sifarish itself, and others in the account.
  - **Sample résumés** — real student/CSE résumés he will upload at session start, plus his
    friends' LaTeX ones which he considers the bar.
  - **Gmail** — where application status emails land (the Babaclick rejection arrived there via
    LinkedIn).
  - **LinkedIn** and **Wellfound** accounts. *"I will be mass applying on various sites , mainly
    through linkedin so I want it to be able to work upon the detailed info I will share with
    it"* — roughly 70% of his applying happens on LinkedIn, and company replies arrive there.
  - Real job posts he will paste, starting with the **Babaclick posting reproduced in Appendix A**.
- **Anything not to be touched:** his LinkedIn and Wellfound accounts are load-bearing for the
  entire job hunt. Getting either restricted or banned is irreversible and would destroy the
  thing this project exists to serve. Anything that risks that is an escalation, not a decision.
- **Must-use / must-avoid tech:** none mandated. He offered one suggestion, as a suggestion, not
  a decision: *"rag wagara jo use karna karo , kuch innovate karna karo , but make this shit get
  working."* Architecture is entirely yours. He also asked for a *"bahut strong"* architecture
  that moves *"like real companies move."*
- **Where it must run:** a URL he can open from anywhere with his password, staying synced —
  whatever he saved or updated is there however he opens it. Plus a public demo mode.
- **Ground-truth documents (read directly, do not summarise from memory):**
  - This brief, including **Appendix A** (the full Babaclick posting and the rejection) and
    **Appendix B** (his own addendum on how his personal data must be held and used — read it
    as part of the brief, not as a footnote).
  - The sample résumés he uploads.
  - His project READMEs, pulled live from GitHub.

---

## HIS STANDARD, AND WHERE IT MAY NOT BE REACHABLE

His standard, exactly as stated:

> "I want my app to be really really smart"

> "the resume should get them a call at any cost"

> "bahut zyada strong resume banne mere , bahut bahut bahut bahut zyada strong"

> "ats ya jo bhi score hota hai maximum ho , even a human reads it voh bhi 100 mein se 100 number
> de , and ats score bhi best aaye"

> "latex ya jo bhi industry ke hisab se hai vaisa ya usse behtar hi"

> "asli resume jaisa kaam ho , formatting se leke ek ek cheez tak , bhai real insaan ko padhaun
> voh bhi move ho jaye aisa ho resume ye bar hai"

> "I want mere resume 100 percent jitna possible hai mere truth ko uss potential pe present karre"

> "highly optimised , kam se kam api cost mein best se best kaam"

> "self evolves , built upon loads and loads of data"

**The truth standard, restated correctly** — because the previous brief got this wrong and it
cost him: **invent nothing, suppress nothing.** Every claim must be true and traceable to
something real he has done. And every true, relevant, provable thing must be *on the page*, in
the strongest honest framing available for that specific company. A true achievement left off
the résumé because the app could not decide how to justify it is a failure of exactly the same
severity as a fabricated one. He has four-ish achievements and got two. That is the bug.

**Where this standard cannot be physically met, say so openly and design around it honestly — a
silent wrong answer is the one unforgivable failure. Identify those places yourselves and log
them in DECISIONS.md.** Four are visible from here; find the rest yourselves:

1. **"Gets a call at any cost"** cannot be guaranteed by any artifact. What is achievable, and
   what you should build toward and be able to evidence: maximising call probability, and making
   it so that if he is rejected, the résumé is not the reason. Do not write a guarantee into the
   product's language anywhere.
2. **"Maximum ATS score"** — there is no single ATS score. Different parsers behave differently
   and most publicly advertised "ATS scores" are marketing. Research what real parsers actually
   do, build to that, and tell him plainly what the honest version of this claim is.
3. **"Self-evolves"** — he has almost no outcome data yet (one application, one rejection, as of
   this brief). Genuine learning from outcomes will take months of use. What is achievable now is
   that new patterns enter as **data he feeds** — new sample résumés, new job posts, recorded
   outcomes — and change behaviour without anyone touching code. Build for that, and be honest
   that the outcome-learning loop starts empty.
4. **"Last time any change will ever be made"** — not physically true. Job boards change their
   markup, model APIs version, résumé conventions shift. The honest form of his wish is: make the
   things that change be *data*, so the app absorbs change without a rebuild. He should never
   need to open Claude Code again for a routine market shift. Design for that explicitly.

One more of his instructions belongs here, because it is a judgement call rather than a rule:

> "voh literally mention karta this resume infact was made by sifarish , bhai impress karta
> padhne wale ko , thats what chalaki si"

> "if hoga voh toh resume mein bhi likhega ki bhai ye bhi khudke project ne hi banaya hai resume"

He wants the résumé to sometimes reveal that it was built by the thing he built. Treat this as a
per-company strategic decision the app reasons about — powerful at an AI-native startup, wrong at
a conservative enterprise — not as a fixed line stamped on every output. He raised it; it is
yours to deploy well.

---

## WHAT HE CANNOT AUDIT

He **can** audit the résumé. He proved it — he found every defect in this brief himself, by
comparing against his friends' résumés and against the outcome. Take his eye seriously.

He **cannot** audit, and should not be asked to:

- Whether a match score is honestly computed. He caught the symptom (*"ye jo bhi applied ai wale
  hain on site , remote , india bahar etc etc kuch bhi hai , saare work ex maangte hain , how are
  you rating them 89/100 etc etc ??"*) but he has no way to check the scoring logic.
- Whether the job sourcing is actually covering the market, or quietly returning a thin slice.
- Whether the architecture, cost profile, or data model is sound.
- Whether an ATS will actually parse the output.

**The verification burden is yours.** Do not hand him something and ask whether it is right —
prove it, and produce the evidence in a form he can hold up to someone else. Specifically: he
should be able to see, for any résumé, *why* each choice was made, and for any ranked job, *why*
it scored what it scored, in plain language. He asked for this indirectly and it is the only way
he can trust the thing enough to stop worrying about it and start applying.

---

## [RE-BRIEF] WHAT EXISTS AND WHY IT MISSED

His criticism, verbatim and uncleaned. Read all of it. This is the most useful diagnostic
material in the document.

> "meri khudki app mein kafi saari problems hain , as you promised voh nhi exist karni chahiye
> thi because main ye maanta hun ki haan 100 percent perfection kabhi reach nhi ki jaa sakti but
> the thing is app goal ko acheive toh karre , goal was bringing me right oppurtunities jo meri
> dil ki baat karein"

> "resume bahut ganda banta hai jo meri app se bann rha hai , like to be honest last time when we
> worked on the app I was the one jisne teri tareef ki thi but no when I compared to what industry
> standards are , what my friends have built the resume sifarish was generating was literally
> trash , because they have perfect latex resumes , wider and longer , and sifarish is just
> building what feels right to it"

> "infact what I asked was sifarish to have brains of real personal assitants and if it were to be
> true sifarish could have kept all the acheivements in my resume but meri 3 4 achievemtns hone ke
> baawjud voh sirf 2 rakhta hai , dimag hota , well trained hota toh dekhta log saari daalte hain
> apni"

> "in short sifarish feels like it has lack of brain buddy even after having every api , every
> fucking api and I am willing to give any other free api jo bhi isko chahiye"

> "yeah even after providing everything these are the shitty responses I am getting lagta hai koi
> murkh resume bana rha hai mera , headline tak itni ai generated lagti hai , ai slop pure"

> "like yaar jo skills added hain in ledger itni fuddu si hain , whsiper ai kaun dalta hai ?"

> "meri khudki app jo oppurtunities mere tak leke aa rhi hai kitni bekaar hain voh main kya bataun
> , yaar itni purani purani ek toh , and yaar jo intern wali hain voh meri vision se aligned nhi
> and jo aligned hain voh intern nhi hain"

> "ye jo bhi applied ai wale hain on site , remote , india bahar etc etc kuch bhi hai , saare work
> ex maangte hain , how are you rating them 89/100 etc etc ??"

> "also jab main company info normally paste karta hun custom packet banane ke liye tab uske
> bawjud itna behudda ai generated kaam karte ho na tum"

> "my sifarish is becoming a waste of time , aise toh reject hi hunga main"

> "ab baba click was a company that needed just vibe coders , uske liye mental ability dekhni thi
> , ab tu ye nhi keh sakta ki mere resume mein required skill nhi hogi ya something kyunki unki jd
> I pasted on sifarish , jd mein it said 11/11 aligned .. but still main reject hui hua , buddy
> vibe coder company jisko skills aur projects se matlab hi nhi tha usne reject kardiya toh soch
> ki meri app kahaan stand kar rhi hai"

> "mere ntse scholar hone ke baad jab I have legit proof ki mera aptitude strong hai nhi hua main
> select because my resume maker is so dumb usko main company ki saari info di and usne saari
> process hi nhi ki kyunki shayad according to it sirf tech skills uthani hoti hain jd se shayad"

> "buddy mri ho sakti thi intern idhar , atleast they would have called me for an interview but
> nhi hua because my resume didnt stand out at all , it needed to stand out man"

> "but nhi you made a shitty app"

**Symptoms he observed, recorded as symptoms — diagnosis is yours:**

1. Résumé is physically too small — noticeably shorter and narrower than peers' LaTeX résumés.
2. Résumé contains **no hyperlinks** at all.
3. Only 2 of his ~4 achievements appear. Only one hackathon (IIT Ropar) is mentioned.
4. NTSE Scholar — his strongest proof of raw aptitude — is not elevated even for a company whose
   entire posting is about reasoning ability.
5. Braillix appears without its innovation angle foregrounded.
6. The Ledger's skills section contains items he considers junk ("Whisper AI"), and JD-required
   skills he genuinely holds do **not** get added to the tailored résumé.
7. The generated headline reads as obviously AI-written, and regenerates differently per role
   without getting better.
8. He pasted the full Babaclick JD; the app reported **11/11 aligned**; he was rejected without an
   interview. The alignment score did not correspond to any real-world outcome.
9. Pasting rich company info beyond the JD does not visibly change the output quality.
10. **Job discovery quality:** postings are old; intern roles surfaced are not vision-aligned;
    vision-aligned roles surfaced are not internships; roles demanding significant work experience
    are scored very high (he cites scores in the 89–100 range in the UI). Screenshots he supplied
    show a Radar view with 3,576 roles, `8 of 3576 roles match` under `India / Intern / Past week /
    GenAI-LLM` filters, `hidden as work-auth ineligible: 160`, and a "Ranked for you" strip giving
    100/100 to senior and non-intern roles including a US-West-Coast Forward Deployed Engineer
    position.
11. Meanwhile **LinkedIn's own feed is now showing him plenty of relevant roles** — his app is
    being beaten by the thing it was built to beat. His words: *"linkedin pe bahut oppurtunities
    aane lagi hain ab aur main ab unhe grab karna chahta hun."*
12. His counter-evidence that off-campus applying itself works, and therefore the app is the weak
    link: *"maine my resume is under review , so it means linkedin mein mera resume dekha toh jaa
    rha hai I mean this way of applying to companies , ye offcampus wala work toh kar rha hai...
    even rejection se bhi mujhe yahi hua ki atleast they give a chance , all I want is a chance to
    fight."*

---

## [RE-BRIEF] BIAS RESET AND SALVAGE

**Inherit zero PRODUCT bias from what exists.** Do not open the existing app and iterate on its
screens, flows, feature list, module names or vocabulary. Do not treat any existing feature as a
floor. Do not preserve a component because it has a name he once liked. Start the product
thinking from nothing — recon first, boardroom second, and let the product that emerges be
whatever your own research says it should be, even if it looks nothing like what is there.

His words: *"I want claude code to have literally 0 bias towards what has been built and what has
it been previously thought of"*, *"I want 0 product bias , jo abhi tak bana so bana bencho I want
dhang ka aur naya kaam , shuru se shuru , yes shuru se shuru"*, *"buddy really scratch everything
built so far."*

**On the code itself:** whether any part of the existing codebase survives is entirely your call,
made after your own review, with the clock as the deciding factor. Reuse something only if you
verify it yourself and it fits the product YOU design — never because it already exists. If
starting a piece from scratch is better, hesitate zero percent. Equally, do not throw away
working plumbing (auth, deploy, integrations, data he has already accumulated) out of sympathy
with his frustration — his frustration is with product shape and output quality, and rebuilding
solved infrastructure spends the one resource he cannot spare, which is time before applications
go out. He is told, in chat, that this is how his "scratch everything" was interpreted.

**Do not destroy his data.** Any existing application history, saved packets, or uploaded material
is irreplaceable to him. Migrate it or preserve it; deleting it is an escalation.

---

## TASTE ANCHOR

His anchors are all real-world, not stylistic references — quote them as given:

- **The résumé:** his friends' LaTeX résumés — *"perfect latex resumes , wider and longer"*, and
  *"latex ya jo bhi industry ke hisab se hai vaisa ya usse behtar hi."* Real student résumés he
  will upload are the direct bar.
- **The app's manner:** a team of personal agents / a CEO's secretary. Talking to it should feel
  like talking to that team — *"like we talk to personal agents , yahaan do this yahaan ye."*
- **The prohibition:** zero AI slop, anywhere, in the app or in anything it generates. He uses
  this phrase repeatedly and it is a standing rule, not a style note. If a screen, a headline, a
  bullet, or a piece of copy could have been produced by any generic AI product, it has failed.
- Whatever direction you choose, a recruiter opening the demo link cold must understand it
  immediately and be impressed.

---

## ANYTHING ELSE HE FLAGGED

The *why*, in his words:

> "and ye normally bata rha hun mujhe babaclick toh genuinely pasand aayi thi .. uski details di
> hain tujhe maine , like interesting laga kaam mujhe , aisa hi toh chaiye tha solving problems
> through ai , and mera focus bhi kuch kuch idhar hi hai"

> "I am learning prob and stats for ai aajkal to develop the mindset , fir calb writes code
> videos and fir agentic ai crash courses taki in depth knowledge ho jaye about rag etc etc ,
> claude code and workflows toh seekhta hi rehta hun and use them daily , like I know jo main
> banna chahta hun ai architect sort of , fde may be or like a person who can direct ai to solve
> any problem iss hisab se toh main sahi hi move kar rha hun"

> "ab maine alag alag roles mein apply karunga ai related app bass har mayne mein vaise dhal jaye"

> "also carry my dil to claude code , meri dil kya chahta hai usse pata ho"

**So that the team knows his heart, since he asked for it to be carried:** he is a final-year
B.Tech CSE student at Thapar Institute, Patiala, graduating 2027. He calls himself an agentic AI
engineer and an AI architect — someone who directs AI to solve problems rather than hand-writing
code, closest current label being Forward Deployed Engineer. NTSE Scholar. He won 1st place in
the Agentic & GenAI showcase at the Techgyan Hackathon, IIT Ropar for Sifarish itself. He built
Braillix, a low-cost refreshable Braille display for blind maths learners, and Sehat Saarthi, a
Punjabi-first clinical decision-support tool. He wants work he genuinely loves, at a place where
his heart is, with good pay — and he wants a fair chance to fight for it. The compulsory
8th-semester internship in January 2027 is the immediate target. **This app exists so that a
company he admires reads one page and decides to talk to him.**

> "meri kahi ek ek cheez vision brief mein mention ki jaye , because main nhi chahta context ka
> thoda sa bhi qatra reh jaye claude code tak pahunchne mein , I want ek ek cheez pahunche uss tak
> , claude code ko ek ek cheez pata chale , ek ek , everything ."

---

## UNSPECIFIED (he skipped these — team decides, logs the call in DECISIONS.md)

- **Pillars / the must-have short list.** He declined again, deliberately, twice now. Derive your
  own priority order in boardroom and log the reasoning. He said *"I want it all"* in effect —
  *"jo jo ek personal agent karta hai I want har cheez ye app kar sake"* — so the prioritisation
  is genuinely yours to make and to defend.
- **Whether paid spend is ever acceptable.** He has only offered more free keys. If free tiers
  cannot carry the required depth, escalate with INR-costed options; do not silently ship a
  shallower product, and do not silently spend.
- **The previous brief's not-now list** (mobile, multi-user, analytics-type views) — void, and
  now unspecified. Decide from scratch.
- **Stack, architecture, data model, art direction, arc plan** — all yours, as always.
- **Auto-apply scope.** He has not restated it in this brief. His prior standing answer was
  "auto-apply wherever possible", with the hard limit that anything risking his LinkedIn or
  Wellfound account is an escalation. Treat the scope as open and decide it yourselves against
  that limit.

---

## THE AUTONOMY CHARTER

He is not available for back-and-forth. His words: *"bass start mein maangle taki claude code
kaam karta rhe fir main apna unbothered padhta rhun."* He is studying, in class, and has exams
coming. Interrupt him only for:

1. **All credentials, once, at the very start** — one message, every key you will need for the
   whole build, with exact baby-step instructions for where to obtain each. Not one at a time,
   not later.
2. Spending real money or exceeding a free tier.
3. Deleting or migrating his existing data, or anything irreversible — **including anything that
   could get his LinkedIn or Wellfound account restricted or banned. Those accounts carry his
   entire job hunt; treat their loss as irreversible and escalate before doing anything that
   risks it.**
4. Publishing publicly for the first time.
5. A genuine product-direction fork where both branches are expensive.

Everything else — library choices, naming, copy, missing assets, design judgment, ambiguity,
scope questions, what to do when something fails twice — decide it, log it in DECISIONS.md, keep
moving. Ideas that arrive mid-arc and don't fit go to NOTES.md unbuilt. PROGRESS.md always holds
the current state and exactly one next action, so any session on any machine resumes from "read
PROGRESS.md and continue." He is trusting the team's expertise exactly as a founder trusts a real
team — and he has said, in as many words, that he does not want to be managing this app in his
head any more.

---

## HOW HE WILL JUDGE IT

He pastes a full job post from a company he admires, and the résumé that comes back is one he
would be proud to hand to a sharp human being — every true achievement present, framed for that
specific company's stated values, properly formatted, hyperlinked, full-size — and it gets him an
interview call.

**If any part of that needs an explanation from me, it didn't pass.**

---

## LAUNCH INSTRUCTIONS (for Shaurya — do not remove this section)

1. Make a folder, drop this file in — plus your sample résumés (as many real student/CSE ones as
   you can gather, including your friends' LaTeX ones) and any full job posts you want it to work
   from. Open Claude Code there.
2. Paste:

   > "Read VISION-BRIEF-sifarish-v2.md including Appendices A and B, and the résumés in this
   > folder. Run
   > the full studio-pipeline starting from research — do your own recon, boardroom, and
   > architecture review; this brief tells you my intent and constraints, not the design. Use
   > every skill in the suite. Verify with the live tools available — browser control on the real
   > app — not just tests. Then build it in arcs, following the Autonomy Charter in the brief so
   > you don't need to come back to me except for the escalation list, and ask for every
   > credential you need in one message at the start."

3. After any break or limit reset: "read PROGRESS.md and continue."

---
---

# APPENDIX A — GROUND TRUTH: the Babaclick case

This is the worked example the founder returns to throughout the brief. It is included in full
because he explicitly asked that no scrap of context be lost. **It is an example of the reasoning
required, not a description of the only role type he wants.**

## A.1 — The outcome

- Applied via LinkedIn on **1 September 2026**. Over 100 applicants. "Promoted by hirer · Actively
  reviewing applicants."
- **Rejected on 4 September 2026**, ~12:40 AM, via a LinkedIn auto-mail: *"Unfortunately, we will
  not be moving forward with your application."* No interview.
- Sifarish had scored his tailored packet **11/11 aligned** against this JD.
- His conclusion: *"vibe coder company jisko skills aur projects se matlab hi nhi tha usne reject
  kardiya toh soch ki meri app kahaan stand kar rhi hai."*

## A.2 — The full posting, as he pasted it

> **Professional Vibe Coder – Growth Internship** — Babaclick · Gurugram, Haryana, India
> (On-site) · Full-time Internship · In person · 12 weeks · ₹40,000/month stipend
>
> Yes, this is a real role. No coding experience required. Exceptional reasoning mandatory.
>
> Most companies treat interns as people who need to be kept away from important decisions. We
> tend to do the opposite. At Babaclick, you will join a small team pursuing a major commercial
> opportunity with the potential to materially increase—and in some cases more than double—our
> revenue. Your job will not be to "support" that team. Your job will be to understand the
> opportunity, research what nobody knows yet, reach your own conclusions, build the systems
> needed to capture it and take responsibility for its impact on the bottom line.
>
> **Why this opportunity exists.** Babaclick is a profitable, London-headquartered global
> e-commerce company with its principal technology and growth team in Gurgaon. We process more
> than 120,000 orders annually and sell through marketplaces including Amazon and Walmart. Our new
> internal platform, Atlas, coordinates purchasing, catalogue decisions, orders, receiving,
> marketplace operations and other parts of the business. We sit in an unusual position. We
> already have marketplace relationships, supplier access, operational infrastructure, software,
> data and international logistics. This means we can pursue opportunities that would require
> someone else to build an entire company first. Many of these opportunities are sitting directly
> in front of us. We need exceptional people to capture them.
>
> **What is a Professional Vibecoder?** AI has shifted the bottleneck in many types of software
> development. Remembering syntax no longer matters. Understanding the real problem, specifying
> behaviour precisely and recognising when the output is wrong matter much more. You might begin
> with research, move into financial modelling, query a database, design a workflow, use an API
> and end by shipping a production system that increases revenue by +10%. You can use Cursor,
> Claude Code, Codex and any other useful AI tool. You do not need previous professional coding
> experience. You do need to think precisely enough to tell an AI what the system must do,
> recognise when its answer is wrong and verify that the finished product works. The distinction
> is simple: a casual vibe coder generates code. A Professional Vibecoder is accountable for the
> result.
>
> **What you will actually do.** We don't believe in busywork. You will be part of a small team
> pursuing a major commercial opportunity reporting directly to the CEO. Your work will involve
> some combination of: investigating markets, products, competitors, regulations and APIs; finding
> reliable information when the answer is not conveniently documented; reconstructing how a
> complicated system works from incomplete evidence; analysing product, order and financial data;
> modelling unit economics and identifying which variables actually matter; forming an independent
> recommendation; building internal tools and automations using AI coding harnesses; working with
> React, Python, FastAPI, PostgreSQL and third-party APIs; testing your work against real data and
> inconvenient edge cases; launching it into the business and measuring impact. You will receive
> important questions, context and access to people who understand the business. You will not
> always receive neatly written tickets or step-by-step instructions.
>
> **You might be unusually good at this if:** you frequently respond to an explanation with, "But
> why does it have to work that way?"; you can become competent in an unfamiliar subject extremely
> quickly when a real problem demands it; you instinctively separate facts, assumptions, inferences
> and unknowns; you care about the economics of an idea, not merely whether it sounds exciting; you
> naturally search for leverage: the small intervention capable of producing the largest result;
> you have built, sold, automated, organised or investigated something without being told how; you
> would rather own a difficult outcome than complete a collection of assigned tasks.
>
> You do not need to be loud, polished or conventionally impressive. You may have excellent grades.
> You may not. Your CV may make perfect sense, or it may look slightly strange. We care about the
> quality of your mind and what you do with it.
>
> **We do not care about:** your university's brand · your degree subject · whether you can write
> code without AI · LeetCode · certificates · corporate vocabulary · whether you have already held
> a prestigious internship · how confidently you can present a weak conclusion.
>
> **We care enormously about:** logical reasoning · intellectual honesty · independent research ·
> quantitative comfort · speed of learning · personal agency · commercial judgment · attention to
> inconvenient details · whether you verify your own work · whether useful things happen because
> you are present.
>
> **Full-Time Offer: Guaranteed.** This internship is designed as a direct route into Babaclick.
> Successfully complete the full 12 weeks, and you are guaranteed a full-time offer. We assess
> performance continuously and aggressively, so there is no final competition for a limited number
> of positions.

## A.3 — Why this appendix is here

Read A.2 as a test case, and ask what a shrewd human agent would have produced from it. A posting
that says *"we do not care about your university's brand, your degree subject, LeetCode,
certificates"* and *"we care enormously about logical reasoning, intellectual honesty, independent
research, quantitative comfort, personal agency, commercial judgment"* is asking for a completely
different résumé from a standard AI-engineer posting. The correct output leads with proof of mind
— NTSE (national-level academic aptitude, ~98.6% in class 10, 90% in class 12), the fact that he
built and shipped Braillix and Sehat Saarthi and Sifarish without being told how, the innovation
angle of Braillix, the hackathon win, the fact that he already works daily in exactly the
harness-directed way this company defines as the job — and it de-emphasises the keyword skill
list that this company has explicitly said it does not care about. It also happens that this
company would likely be *delighted* to learn the résumé in their hands was produced by the
applicant's own AI system.

The previous build pulled tech skills off the JD and returned "11/11 aligned."

**That gap — between what the app did and what a sharp human agent would have done with the same
inputs — is the product you are being asked to build.**

---
---

# APPENDIX B — FROM THE FOUNDER: how my information must be held and used

Added 5 September 2026, after the main brief. **This is not a footnote — read it as part of the
brief.** One capability sits above everything else in this document, and it is stated here
plainly before you start designing.

## B.1 — Everything I know about myself must be feedable, and the app must be shrewd about when to use what

Whatever exists in my data — a certificate, an achievement, a work experience, an award, a
responsibility, or something that looks irrelevant on paper like "district-level badminton
player" — the app should hold it, understand it, and decide like a master strategist when it
belongs on a résumé and when it doesn't. Sometimes the badminton line is the strongest thing on
the page, for the right company. Sometimes a certificate should be buried. **That judgement is
the product.**

In my words:

> "buddy mere data mein jo jo hoga , bhale certifaction ho , acheivement , work ex and shand
> kuch ho na ho , app samjhdaar aur itni chalaak ho kab kya use karna master strategist ki tarah
> pata ho"

> "even chahe info is I am a distrcit level badmintion player , examples hain"

## B.2 — I am not going to maintain a fixed set of fields

If I tell it something, it should figure out where that belongs — and **if no place exists for
it, it should create the place.**

> "team ko bola yaar work ex ka section bana jahaan mera data you store toh naya section bana
> wahaan baat karke new info add karwadi , etc etc"

> "maine bola for example mere paas ye certificate hai , toh app uss data ko khud se section
> mein ya kuch bhi add kar sake kuch jo chahe kar sake"

So: absorb it on its own, create the section, store it, and know it exists forever after. I
should never be filling a form that someone decided the shape of in advance.

## B.3 — Talking to the app means talking to the team, at every single point

Adding data, changing data, restructuring how my information is held, changing how a résumé is
built, executing any idea I have — all of it should be as easy as saying it out loud.

> "aise like sab baat karne jitna asaan ho mere liye har point pe har tarah ka data about myself
> I should be able to feed it"

> "like we talk to personal agents , yahaan do this yahaan ye"

There must be no screen where I hit a wall and have to work around the product instead of
talking to it.

## B.4 — Skills must be chosen for the job, not maintained by me

> "also jd ke hisab se skills khud add hon resume mein , not sirf jody like overall all the info
> man all the info"

The skills on a résumé should be assembled from what that specific company needs, matched
against what is genuinely true of me — not read off a stored list. A stored list is a
maintenance chore and it goes stale. That is the exact failure I am rebuilding away from (see
the kill list in the main brief).

## B.5 — My data will keep growing, and that must never require a rebuild

> "ab karliya maine most of the syllabus in ai , aage bhi chalta rahega though and projects bhi
> banata rahunga , I am seeing more and more problems these days jinpe ai skills se kaam karta
> rahunga main"

I have now covered most of the AI syllabus and I will keep going. I keep building projects, and
I keep finding real problems I want to solve with AI skills. The set of things true about me in
six months will be substantially larger than today's. The app must absorb all of that as data I
simply tell it — **no code change, and no session with you.**

## B.6 — All the information, not a subset

> "overall all the info man all the info"

Nothing about me should be invisible to the thing writing my résumé. If it is in my data, the
strategist has it in hand and chooses whether to play it.

## B.7 — The standard for the whole thing

Build against this sentence:

> "in the end aise kaam karre ki duniya ka sabse chalaak aur skilled aur knowledge wala insaan
> kaam kar rha hai , ek proper studio of highly skilled personal agents"

A proper studio of highly skilled personal agents. **Not a tool.**

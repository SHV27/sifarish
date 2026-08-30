import type { Identity, LedgerEntry } from '../../types'

/**
 * APPLY COCKPIT — the install-once autofill bookmarklet (re-brief Pillar 2; DECISIONS RB-1).
 *
 * The lawful ceiling of "auto-apply" is prefill-everything-submit-nothing (RESEARCH.md verdict 1:
 * Simplify-class prefill + human click is the industry safe harbor; every unattended lane is
 * ToS-banned or employer-credential-gated). This generates a `javascript:` bookmarklet baked
 * from his IDENTITY facts that fills application-form fields in HIS browser on the employer's
 * page — a real browser session, his click, his submission.
 *
 * STRUCTURAL LIMITS (gated in cockpit.test.ts, the I3 discipline):
 *  - contains NO fetch/XHR/WebSocket — it cannot call any server, ours included;
 *  - contains NO .submit() and NO .click() — it cannot activate any control;
 *  - contains NO key material — identity facts only (the same facts printed on the resume);
 *  - fills only FACT fields (name/email/phone/links/location/school/degree). Authorization,
 *    sponsorship and screening QUESTIONS are never auto-answered — those carry judgment and
 *    live in the cockpit's copy panel with honest drafted answers.
 */

export interface AutofillProfile {
  fullName: string
  firstName: string
  lastName: string
  email: string
  phone: string
  linkedin: string
  github: string
  website: string
  location: string
  city: string
  school: string
  degree: string
}

const httpize = (s: string) => (s && !/^https?:\/\//.test(s) ? `https://${s}` : s)

export function buildProfile(identity: Identity, education: LedgerEntry[], liveUrl?: string): AutofillProfile {
  const parts = identity.name.trim().split(/\s+/)
  const degreeEntry = education.find((e) => /b\.?tech|bachelor|degree|b\.?e\.|m\.?tech|master/i.test(e.title)) ?? education[0]
  const [degree, school] = (degreeEntry?.title ?? '').split('—').map((s) => s.trim())
  return {
    fullName: identity.name,
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    email: identity.email,
    phone: identity.phone,
    linkedin: httpize(identity.linkedin),
    github: httpize(identity.github),
    website: httpize(liveUrl ?? identity.github),
    location: identity.location,
    city: identity.location.split(/[,/]/)[0]?.trim() ?? '',
    school: school ?? '',
    degree: degree ?? '',
  }
}

/** The in-page filler, stringified into the bookmarklet. Plain DOM + native setters (React-safe). */
function fillerSource(profileJson: string): string {
  // NOTE: this string executes on the EMPLOYER'S page. Keep it dependency-free and inert
  // beyond assignment + events. No network, no submission, no navigation.
  return (
    '(function(){var P=' +
    profileJson +
    ';var M=[' +
    '["firstName",["first name","first_name","firstname","first-name","given-name","fname"]],' +
    '["lastName",["last name","last_name","lastname","last-name","family-name","surname","lname"]],' +
    '["email",["email","e-mail"]],' +
    '["phone",["phone","mobile","tel","contact number"]],' +
    '["linkedin",["linkedin"]],' +
    '["github",["github"]],' +
    '["website",["website","portfolio","personal site"]],' +
    '["location",["current location","location","address"]],' +
    '["city",["city"]],' +
    '["school",["school","university","college","institution"]],' +
    '["degree",["degree","qualification"]],' +
    '["fullName",["full name","your name","legal name","complete name"]]' +
    '];' +
    'var els=document.querySelectorAll("input,textarea");var filled=0,total=0;' +
    'var setV=function(el,v){var proto=el.tagName==="TEXTAREA"?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;' +
    'var d=Object.getOwnPropertyDescriptor(proto,"value");if(d&&d.set){d.set.call(el,v);}else{el.value=v;}' +
    'el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));};' +
    // WORD-BOUNDED matching (live Greenhouse proof caught it: "city" matched inside
    // "hispanic_ethniCITY" and filled a demographic field with his city) + a hard DENY list:
    // self-identification questions are NEVER auto-filled, whatever they match.
    'var DENY=/(gender|race|ethnic|hispanic|veteran|disab|pronoun|orientation|religio|caste)/;' +
    'var esc=function(s){return s.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&");};' +
    'var hasWord=function(hay,pat){return new RegExp("(^|[^a-z0-9])"+esc(pat)+"([^a-z0-9]|$)").test(hay);};' +
    'els.forEach(function(el){var t=(el.getAttribute("type")||"text").toLowerCase();' +
    'if(["hidden","file","checkbox","radio","password","submit","button"].indexOf(t)>=0)return;' +
    'if(el.value&&el.value.trim().length>0)return;' + // never overwrite what he typed
    'total++;var hay=(el.name||"")+" "+(el.id||"")+" "+(el.getAttribute("placeholder")||"")+" "+(el.getAttribute("aria-label")||"")+" "+(el.getAttribute("autocomplete")||"");' +
    'var lab=el.id?document.querySelector("label[for=\\""+el.id+"\\"]"):null;if(lab)hay+=" "+lab.textContent;' +
    'if(!lab&&el.closest("label"))hay+=" "+el.closest("label").textContent;' +
    'hay=hay.toLowerCase().replace(/[_-]+/g," ");' +
    'if(DENY.test(hay))return;' +
    'if(t==="email"){if(P.email){setV(el,P.email);filled++;}return;}' +
    'if(t==="tel"){if(P.phone){setV(el,P.phone);filled++;}return;}' +
    'for(var i=0;i<M.length;i++){var key=M[i][0],pats=M[i][1],hit=false;' +
    'for(var j=0;j<pats.length;j++){if(hasWord(hay,pats[j])){hit=true;break;}}' +
    'if(hit&&P[key]){setV(el,P[key]);filled++;return;}}' +
    '});' +
    'var b=document.createElement("div");b.textContent="SIFARISH filled "+filled+" of "+total+" empty fields - review everything, attach your files, and submit it yourself.";' +
    'b.setAttribute("style","position:fixed;top:12px;right:12px;z-index:99999;background:#1B2A4A;color:#F7F2E7;padding:10px 14px;border-radius:8px;font:13px system-ui;box-shadow:0 4px 14px rgba(0,0,0,.35);max-width:320px;cursor:pointer");' +
    'b.onclick=function(){b.remove();};document.body.appendChild(b);setTimeout(function(){if(b.parentNode)b.remove();},12000);' +
    '})();'
  )
}

/** The bookmarklet URL — drag it to the bookmarks bar once; it works on every application form. */
export function buildBookmarklet(profile: AutofillProfile): string {
  return 'javascript:' + encodeURIComponent(fillerSource(JSON.stringify(profile)))
}

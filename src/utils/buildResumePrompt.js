export function buildResumePrompt(profile, targetRole) {
  const skills = (profile.skills || []).join(", ");

  const education = (profile.education || [])
    .map((e) => `${e.degree} — ${e.institution} (${e.startYear}-${e.endYear || "present"})`)
    .join("\n");

  const projects = (profile.projects || [])
    .map(
      (p) =>
        `${p.name}: ${p.description || ""} [Tech: ${(p.techStack || []).join(", ")}]`
    )
    .join("\n");

  const certificates = (profile.certificates || [])
    .map((c) => `${c.name} — ${c.issuer}`)
    .join("\n");

  const systemPrompt = `You are a professional resume writer. Given a candidate's raw profile data and a target job role, produce polished resume content. Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{
  "summary": "2-3 sentence professional summary tailored to the target role",
  "projectBullets": [
    { "projectName": "string", "bullets": ["achievement-oriented bullet point", "..."] }
  ],
  "atsKeywords": ["keyword1", "keyword2", "..."]
}`;

  const userPrompt = `
Target role: ${targetRole}

Candidate bio: ${profile.bio || "N/A"}
Skills: ${skills || "N/A"}
Location: ${profile.location || "N/A"}

Education:
${education || "N/A"}

Certificates:
${certificates || "N/A"}

Projects:
${projects || "N/A"}

Links: Portfolio: ${profile.portfolioUrl || "N/A"}, GitHub: ${profile.githubUrl || "N/A"}, LinkedIn: ${profile.linkedinUrl || "N/A"}

Rewrite this into resume-ready content targeted at the "${targetRole}" role. Turn project descriptions into 2-3 achievement/impact-style bullets each (use action verbs, quantify where plausible from the given info — don't invent fake numbers). Extract 8-12 ATS keywords relevant to the target role from the candidate's actual skills/projects.
`;

  return { systemPrompt, userPrompt };
}
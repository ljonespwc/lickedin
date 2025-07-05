# LickedIn Interviews - MVP Wireframes

## 1. Landing Page (`/`)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo: LickedIn Interviews]                    [Login] [Signup] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              🎯 Nail Your Next Interview                    │
│         Practice with AI-powered mock interviews           │
│                                                             │
│    [Upload Resume & Job Description to Get Started]        │
│                                                             │
│              ────── How It Works ──────                    │
│                                                             │
│   📄 Upload     🎭 Customize     🎤 Interview     📊 Improve │
│   Resume &      Difficulty &     Live with       Get Scored │
│   Job Post      Persona          Voice AI        Feedback   │
│                                                             │
│              ────── Why LickedIn? ──────                   │
│                                                             │
│   ✅ Personalized questions based on your background       │
│   ✅ Real-time voice conversations                         │
│   ✅ Fun interviewer personas (Michael Scott & more!)      │
│   ✅ Instant feedback and scoring                          │
│                                                             │
│                    [Get Started Free]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Clear value proposition above the fold
- Visual step-by-step process
- Single prominent CTA
- Social proof/benefits section
- Auth options in header

---

## 2. Setup Page (`/setup`)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Setup Your Interview                        [Profile▼] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     Step 1 of 2: Upload Files             │
│                                                             │
│   ┌─────────────────────┐    ┌─────────────────────────┐   │
│   │   📄 Resume         │    │   🔗 Job Description    │   │
│   │                     │    │                         │   │
│   │ [Drop PDF/TXT here] │    │ [Paste job URL here]   │   │
│   │  or click to browse │    │                         │   │
│   │                     │    │ ┌─────────────────────┐ │   │
│   │ ✅ resume.pdf       │    │ │https://company.com/ │ │   │
│   │    (uploaded)       │    │ │/jobs/123           │ │   │
│   │                     │    │ └─────────────────────┘ │   │
│   │                     │    │                         │   │
│   │                     │    │    [Fetch Job Details]  │   │
│   └─────────────────────┘    └─────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 🤖 AI Processing Status                            │   │
│   │ ◐ Analyzing your background and job requirements...│   │
│   │ ✅ Resume parsed successfully                      │   │
│   │ ◐ Extracting job requirements...                   │   │
│   │ ⏳ Generating personalized questions...            │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                    [Continue to Setup →]    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Two-column upload interface
- Real-time processing status
- Clear file upload states
- Progress indicator
- Disabled continue button until processing complete

---

## 3. Interview Customization (`/setup/customize`)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Customize Your Interview               [Profile▼]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                   Step 2 of 2: Customize                   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 🔥 Interview Difficulty                            │   │
│   │                                                    │   │
│   │ ○ Softball        ● Medium        ○ Hard          │   │
│   │   (Easy Q's)       (Realistic)     ○ Hard as F*ck │   │
│   │                                     (Good luck!)   │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 🎭 Choose Your Interviewer                         │   │
│   │                                                    │   │
│   │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│   │ │Michael  │ │Generic  │ │Friendly │ │Tech     │   │   │
│   │ │Scott    │ │Pro      │ │Mentor   │ │Lead     │   │   │
│   │ │  😎     │ │  👔     │ │  😊     │ │  🤓     │   │   │
│   │ │[Select] │ │[Select] │ │[Select] │ │[Select] │   │   │
│   │ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 📋 Interview Details                               │   │
│   │                                                    │   │
│   │ Questions: 5 (perfect for a demo!)                │   │
│   │ Estimated time: 10-15 minutes                     │   │
│   │ Job: Frontend Developer at TechCorp               │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│                              [Start Interview →]           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Clear difficulty options with personality
- Visual persona selection with emojis
- Interview summary/preview
- Single prominent start button

---

## 4. Interview Interface (`/interview/[session-id]`)

```
┌─────────────────────────────────────────────────────────────┐
│                    LIVE INTERVIEW                           │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                                                    │   │
│   │              🎭 Michael Scott                      │   │
│   │                                                    │   │
│   │        "So tell me, what makes you think          │   │
│   │         you're qualified for this position        │   │
│   │         at our amazing company?"                   │   │
│   │                                                    │   │
│   │                                                    │   │
│   │              🟢 ● Speaking...                      │   │
│   │                                                    │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 🎤 Your Response                                   │   │
│   │                                                    │   │
│   │ [Transcription appears here as you speak...]      │   │
│   │                                                    │   │
│   │                                                    │   │
│   │ 🔴 ● Recording...        [⏸️ Pause]   [🛑 Stop]    │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Progress: Question 2 of 5                          │   │
│   │ ████████░░░░░░░░░░ 40%                             │   │
│   │                                          Time: 4:32│   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Full-screen, distraction-free interface
- Clear persona representation
- Real-time transcription
- Voice recording controls
- Progress tracking
- Timer

---

## 5. Interview Results (`/results/[session-id]`)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Interview Results                        [Profile▼]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              🎉 Interview Complete!                        │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 📊 Overall Performance                             │   │
│   │                                                    │   │
│   │               Score: 78/100                        │   │
│   │                                                    │   │
│   │ Communication: ████████░░ 82/100                   │   │
│   │ Content:       ███████░░░ 74/100                   │   │
│   │ Confidence:    ████████░░ 80/100                   │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 📝 Question-by-Question Breakdown                  │   │
│   │                                                    │   │
│   │ Q1: "Tell me about yourself"              85/100   │   │
│   │ ✅ Good structure and clear examples               │   │
│   │ 💡 Try to mention specific metrics next time      │   │
│   │                                                    │   │
│   │ Q2: "Why do you want this role?"          72/100   │   │
│   │ ⚠️ Answer was too generic                         │   │
│   │ 💡 Research the company's recent projects         │   │
│   │                                                    │   │
│   │ [View All Questions]                               │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 🚀 Recommended Next Steps                          │   │
│   │                                                    │   │
│   │ • Practice answering with specific examples        │   │
│   │ • Research the company's values and mission       │   │
│   │ • Try a "Hard" difficulty interview next          │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   [Practice Again]              [Share Results]  [Dashboard]│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Celebratory header
- Overall score with breakdown
- Detailed question-by-question feedback
- Actionable improvement suggestions
- Clear next steps

---

## 6. Simple Dashboard (`/dashboard`)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Your Interview History                  [Profile▼]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     Welcome back!                          │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 📈 Your Progress                                   │   │
│   │                                                    │   │
│   │ Interviews completed: 3                            │   │
│   │ Average score: 76/100                              │   │
│   │ Best performance: 85/100                           │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 📋 Recent Interviews                               │   │
│   │                                                    │   │
│   │ Frontend Dev @ TechCorp    78/100    2 days ago    │   │
│   │ UX Designer @ StartupCo    74/100    1 week ago    │   │
│   │ Product Manager @ BigCorp  85/100    2 weeks ago   │   │
│   │                                                    │   │
│   │                                    [View All]      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│                       [Start New Interview]                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Simple progress tracking
- Recent interview history
- Prominent CTA for new interview

---

## Mobile Considerations (Future)

While MVP focuses on desktop, key mobile adaptations would be:
- Stack elements vertically
- Larger touch targets
- Simplified navigation
- Voice-first interface on interview page
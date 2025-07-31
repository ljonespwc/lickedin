import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

// Tony Stark Resume Content
const TONY_STARK_RESUME = `# Anthony Edward "Tony" Stark
**Chief Executive Officer & Chief Technology Officer**

📧 tstark@starkindustries.com | 📱 (555) GENIUS-1 | 🌐 LinkedIn: /in/tonystark | 📍 Malibu, CA

---

## Executive Summary

Visionary technology leader and serial entrepreneur with 15+ years driving breakthrough innovations in clean energy, advanced materials, and autonomous systems. Led company transformation from defense contractor to global clean tech pioneer, increasing valuation by 2,400%. Holds 73+ patents in propulsion, energy storage, and AI systems. Known for rapid prototyping, disruptive thinking, and turning impossible engineering challenges into market-defining products.

---

## Core Competencies

**Technical Leadership:** Advanced Propulsion Systems • Clean Energy Infrastructure • AI/Machine Learning • Sustainable Manufacturing • Rapid Prototyping • Materials Science

**Business Strategy:** Corporate Transformation • Product Innovation • Global Market Expansion • Strategic Partnerships • Crisis Management • Public-Private Sector Relations

**Leadership Style:** High-Performance Teams • Innovation Culture • Direct Communication • Results-Driven Execution

---

## Professional Experience

### **Chief Executive Officer & CTO** | Stark Industries | 2008 - Present
*Leading global technology conglomerate specializing in clean energy and advanced manufacturing*

**Strategic Transformation:**
- Pivoted company from defense contracting to clean energy leadership, achieving 2,400% valuation increase
- Launched Arc Reactor technology, revolutionizing clean energy storage and distribution
- Established Stark Industries as the world's leading sustainable technology manufacturer
- Built strategic partnerships with government agencies and international organizations

**Technology Innovation:**
- Invented and commercialized Arc Reactor clean energy technology (73+ related patents)
- Developed advanced autonomous systems and AI integration platforms
- Created revolutionary materials science applications for aerospace and energy sectors
- Led R&D team of 200+ engineers across 12 global innovation centers

**Operational Excellence:**
- Scaled manufacturing operations to 40+ countries with zero environmental incidents
- Implemented sustainable supply chain reducing carbon footprint by 89%
- Achieved industry-leading safety record while maintaining accelerated production timelines

### **Lead Systems Engineer** | Stark Industries | 2005 - 2008
*Advanced weapons systems and defense technology development*

- Designed next-generation defense systems resulting in $2.1B in government contracts
- Led cross-functional engineering teams on classified high-stakes projects
- Pioneered miniaturization techniques for complex electronic systems
- Established rapid prototyping methodologies adopted company-wide

---

## Education & Credentials

**Massachusetts Institute of Technology (MIT)**
- Master of Science, Electrical Engineering (Graduated Summa Cum Laude, Age 19)
- Bachelor of Science, Physics (Double Major, Graduated Age 17)
- *Youngest graduate in MIT history*

**Professional Development:**
- Advanced Leadership Program, Stanford Graduate School of Business
- Global Technology Policy Fellowship, World Economic Forum

---

## Patents & Publications

- **73+ Granted Patents** in energy storage, propulsion systems, and AI integration
- **12 Peer-Reviewed Publications** in Nature, Science, and IEEE journals
- **Keynote Speaker** at 25+ international technology conferences

---

## Awards & Recognition

- **Time Magazine Person of the Year** (2023) - "Clean Energy Revolutionary"
- **MIT Technology Review Innovator Under 35** (Awarded at 21)
- **World Economic Forum Young Global Leader**
- **Forbes Most Innovative CEO** (3 consecutive years)
- **IEEE Medal of Honor** for contributions to sustainable energy systems

---

## Board Positions & Affiliations

- **Board Member:** Clean Energy Research Institute
- **Advisor:** MIT Technology Advisory Board
- **Member:** World Economic Forum Global Future Council on Advanced Manufacturing
- **Founding Member:** Breakthrough Energy Coalition

---

## Languages & Additional Skills

- **Languages:** English (Native), Italian (Fluent), Mandarin (Conversational)
- **Pilot License:** Commercial Multi-Engine, Instrument Rating
- **Security Clearance:** Top Secret (Inactive)

---

*"The best way to predict the future is to invent it."* - Personal Philosophy`

// Apple CEO Job Description Content
const APPLE_CEO_JOB = `# Chief Executive Officer
**Apple Inc. • Cupertino, CA**
*Full-time • Executive Level*

Posted 2 days ago • 847 applicants

---

## About Apple
At Apple, we believe technology should elevate humanity. For over four decades, we've been the architects of products that don't just meet needs—they create entirely new possibilities. From the personal computer revolution to the smartphone era, Apple has consistently redefined what's possible when cutting-edge technology meets intuitive design.

Today, we stand at another inflection point. As AI reshapes every industry and spatial computing emerges as the next frontier, Apple seeks a visionary leader to guide us through our most ambitious chapter yet.

---

## The Role
We are seeking an exceptional Chief Executive Officer to lead Apple into its next era of innovation and growth. This is a once-in-a-generation opportunity to helm the world's most valuable technology company during a period of unprecedented technological transformation.

You will inherit a company at the peak of its powers—with the iPhone generating $200B+ annually, Services growing at 20%+ year-over-year, and a cash position exceeding $160B. Yet you'll also face our most complex strategic challenges: reimagining AI integration across our ecosystem, defining the future of spatial computing, and pioneering entirely new product categories that will drive the next decade of growth.

---

## Critical Strategic Priorities

### **AI Revolution & Siri Renaissance**
- **Challenge**: Transform Siri from a functional assistant into a truly intelligent, contextual AI that rivals ChatGPT and rivals' implementations
- **Opportunity**: Integrate advanced AI capabilities across all Apple products while maintaining our privacy-first approach
- **Leadership Required**: Navigate the tension between AI advancement and user privacy, making Apple's AI strategy distinctively Apple

### **Vision Pro Market Strategy**
- **Challenge**: Chart the path forward for Apple Vision Pro—currently a groundbreaking but niche product with limited mainstream adoption
- **Opportunity**: Define spatial computing's mass market potential and determine optimal price points, use cases, and market positioning
- **Leadership Required**: Make decisive calls on product iteration, market education, and long-term AR/VR roadmap

### **Next-Generation Product Categories**
- **Challenge**: Identify and execute on the "next iPhone"—a product category that doesn't exist yet but could generate tens of billions in new revenue
- **Opportunity**: Leverage Apple's ecosystem, design expertise, and financial resources to create entirely new markets
- **Leadership Required**: Foster innovation culture while maintaining Apple's quality standards and brand integrity

---

## Key Responsibilities

**Strategic Leadership**
- Define and execute Apple's 10-year vision for AI, spatial computing, and emerging technologies
- Make critical product portfolio decisions, including potential expansion into healthcare, automotive, or other adjacent markets
- Navigate complex global regulatory environment, especially regarding App Store policies, privacy regulations, and antitrust concerns

**Innovation & Product Excellence**
- Maintain Apple's design-first culture while accelerating development cycles to match competitive pace
- Oversee integration of AI capabilities across hardware and software without compromising user experience
- Drive breakthrough innovations in materials science, display technology, and human-computer interaction

**Operational Excellence**
- Manage global supply chain and manufacturing operations across 40+ countries
- Lead 150,000+ employees while preserving Apple's collaborative, secretive, and quality-obsessed culture
- Optimize Services revenue growth while balancing ecosystem openness with competitive advantages

**Financial Stewardship**
- Deploy $160B+ cash position strategically across R&D, acquisitions, and shareholder returns
- Maintain premium pricing strategy while expanding addressable markets
- Navigate investor expectations for continued growth despite iPhone market maturation

---

## Required Qualifications

**Leadership Experience**
- 15+ years of senior executive experience at technology companies with >$50B revenue
- Proven track record of leading large-scale digital transformations
- Experience managing global, matrixed organizations with 50,000+ employees

**Technical Fluency**
- Deep understanding of AI/ML, computer vision, and human-computer interface design
- Knowledge of semiconductor technology, manufacturing processes, and supply chain management
- Experience with platform ecosystems, developer relations, and two-sided markets

**Strategic Acumen**
- History of identifying and capitalizing on emerging technology trends
- Experience with regulatory challenges in global markets (US, EU, China)
- Track record of balancing innovation investment with financial performance

**Cultural Leadership**
- Ability to maintain and evolve Apple's unique culture of secrecy, perfectionism, and user-centricity
- Experience presenting to global audiences, media, and developer communities
- Demonstrated commitment to privacy, environmental sustainability, and social responsibility

---

## Preferred Qualifications
- Previous CEO or President experience at Fortune 100 technology company
- Background in consumer electronics, software platforms, or AI research
- MBA from top-tier institution or equivalent strategic business education
- Multilingual capabilities (Mandarin, German, or Japanese preferred)
- Experience with direct-to-consumer retail operations

---

## What We Offer
- Competitive base salary ($3M+) with performance-based equity compensation
- Opportunity to lead the world's most valuable company during its most transformative period
- Access to Apple's unparalleled resources: $160B cash, world-class design teams, global supply chain
- Platform to impact billions of users through products that shape human behavior and societal norms
- Legacy opportunity: Join the ranks of Steve Jobs and Tim Cook in defining Apple's next chapter

---

## Compensation
Base salary: $3,000,000 - $5,000,000 annually
Total potential compensation: $50,000,000 - $100,000,000 (including equity grants, performance bonuses)

*Compensation is competitive with Fortune 10 CEO packages and includes comprehensive benefits, housing allowances, security provisions, and private transportation.*

---

**To Apply:** This role requires Board of Directors approval and extensive vetting process. Interested candidates should submit strategic vision documents addressing AI integration, Vision Pro roadmap, and new product category proposals.

**Apple is an Equal Opportunity Employer committed to inclusion and diversity.**`

// Custom Tony Stark Questions for Apple CEO
const TONY_STARK_QUESTIONS = [
  "Tony, your Arc Reactor technology revolutionized clean energy at Stark Industries. How would you apply that innovation mindset to help Apple achieve carbon neutrality by 2030 while maintaining rapid product development cycles?",
  
  "You've successfully managed both the Avengers superhero team and a global corporation. How would your experience handling strong personalities like Thor and Tony prepare you to lead Apple's 150,000 employees and executive team?",
  
  "Siri clearly needs an intelligence upgrade to compete with ChatGPT and other AI assistants. How would you transform Siri to be as responsive and capable as your FRIDAY AI system, while preserving Apple's privacy-first approach?",
  
  "Apple Vision Pro has groundbreaking technology but slow adoption. You've made spatial computing work with your heads-up displays and holographic interfaces. What's your strategy to make Vision Pro as transformative as the iPhone?",
  
  "At Stark Industries, you pivoted from weapons manufacturing to clean technology. If you had to identify Apple's next major product category beyond phones and computers, what emerging technology would you bet the company on?",
  
  "Managing the egos and conflicts within the Avengers taught you crisis leadership. How would you handle Apple's complex relationship with global regulators, especially around App Store policies and antitrust concerns?",
  
  "Your rapid prototyping approach allowed you to build the Mark I suit in a cave with scraps. How would you accelerate Apple's traditionally secretive, perfectionist development culture to compete with faster-moving AI companies?",
  
  "You've literally saved the world multiple times and revolutionized entire industries. Looking at Apple's next decade, what's your vision for how the company can have its most significant impact on humanity's future?"
]

export async function POST(request: NextRequest) {
  try {
    console.log('🦾 Tony Stark Demo: Starting demo creation...')

    // Get authentication token
    const authHeader = request.headers.get('authorization')
    let accessToken: string | null = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    // Create Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: { [key: string]: unknown }) {
            cookieStore.set({ 
              name, 
              value, 
              ...options,
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/'
            })
          },
          remove(name: string, options: { [key: string]: unknown }) {
            cookieStore.set({ 
              name, 
              value: '', 
              ...options,
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/'
            })
          },
        },
        global: {
          headers: accessToken ? {
            Authorization: `Bearer ${accessToken}`
          } : {}
        }
      }
    )

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken || undefined)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('🦾 User authenticated:', user.id)

    // Generate resume summary
    console.log('🤖 Generating resume summary...')
    const resumeSummaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Create a concise 150-word summary of this resume for voice interview context:\n\n${TONY_STARK_RESUME}`
      }],
      max_tokens: 200,
      temperature: 0.3
    })

    const resumeSummary = resumeSummaryResponse.choices[0]?.message?.content || 'Tony Stark: MIT graduate, CEO/CTO of Stark Industries, expert in clean energy and AI systems.'

    // Generate job description summary  
    console.log('🍎 Generating job description summary...')
    const jobSummaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Create a concise 150-word summary of this job description for voice interview context:\n\n${APPLE_CEO_JOB}`
      }],
      max_tokens: 200,
      temperature: 0.3
    })

    const jobSummary = jobSummaryResponse.choices[0]?.message?.content || 'Apple CEO role: Lead AI transformation, Vision Pro strategy, and next-generation product development.'

    // Insert resume data
    console.log('📄 Inserting Tony Stark resume...')
    const { data: resumeData, error: resumeError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        filename: 'tony-stark-resume.md',
        file_url: 'demo://tony-stark-resume',
        parsed_content: TONY_STARK_RESUME,
        parsed_summary: resumeSummary,
        file_size_bytes: TONY_STARK_RESUME.length
      })
      .select()
      .single()

    if (resumeError) {
      console.error('Resume insertion error:', resumeError)
      return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 })
    }

    // Insert job description data
    console.log('🍎 Inserting Apple CEO job description...')
    const { data: jobData, error: jobError } = await supabase
      .from('job_descriptions')
      .insert({
        user_id: user.id,
        url: 'https://jobs.apple.com/ceo-demo',
        job_content: APPLE_CEO_JOB,
        job_summary: jobSummary,
        company_name: 'Apple Inc.',
        job_title: 'Chief Executive Officer'
      })
      .select()
      .single()

    if (jobError) {
      console.error('Job description insertion error:', jobError)
      return NextResponse.json({ error: 'Failed to create job description' }, { status: 500 })
    }

    // Create interview session with demo flag
    console.log('🎬 Creating interview session...')
    const { data: sessionData, error: sessionError } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: user.id,
        resume_id: resumeData.id,
        job_description_id: jobData.id,
        difficulty_level: '5', // Medium difficulty
        interview_type: 'hiring_manager',
        voice_gender: 'male',
        communication_style: 'corporate_professional',
        question_count: 8,
        demo_type: 'tony_stark', // Mark as demo
        status: 'pending'
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Session creation error:', sessionError)
      return NextResponse.json({ error: 'Failed to create interview session' }, { status: 500 })
    }

    // Insert custom Tony Stark questions
    console.log('❓ Inserting custom Tony Stark questions...')
    const questionInserts = TONY_STARK_QUESTIONS.map((question, index) => ({
      session_id: sessionData.id,
      question_text: question,
      question_order: index + 1,
      question_type: 'behavioral'
    }))

    const { error: questionsError } = await supabase
      .from('interview_questions')
      .insert(questionInserts)

    if (questionsError) {
      console.error('Questions insertion error:', questionsError)
      return NextResponse.json({ error: 'Failed to create questions' }, { status: 500 })
    }

    console.log('✅ Tony Stark demo created successfully:', sessionData.id)

    return NextResponse.json({
      success: true,
      sessionId: sessionData.id,
      message: 'Tony Stark demo interview created successfully'
    })

  } catch (error) {
    console.error('Tony Stark demo creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
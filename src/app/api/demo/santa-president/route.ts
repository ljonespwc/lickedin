import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

// Santa Claus Resume Content
const SANTA_CLAUS_RESUME = `# Nicholas "Santa" Claus
**Chief Executive Officer & Global Operations Director**

📧 s.claus@northpole.org | 📱 HO-HO-HO-2024 | 🌐 LinkedIn: /in/santaclaus | 📍 North Pole, Arctic

---

## Executive Summary

Transformational leader with 1,700+ years of experience in global logistics, international relations, and large-scale manufacturing operations. Successfully manages the world's largest gift distribution network, serving 2.6 billion children across 195 countries with 99.97% on-time delivery rate. Expert in crisis management, multicultural leadership, and sustainable operations in extreme environments. Known for maintaining the highest employee satisfaction ratings in recorded history while operating the most complex supply chain on Earth.

---

## Core Competencies

**Global Operations:** International Logistics • Cross-Cultural Management • Crisis Response • Supply Chain Optimization • Real-Time Analytics • Weather-Independent Operations

**Leadership:** Team Building • Conflict Resolution • Performance Management • Succession Planning • Cultural Transformation • Stakeholder Relations

**Innovation:** Process Improvement • Technology Integration • Sustainable Practices • Research & Development • Product Innovation • Operational Excellence

---

## Professional Experience

### **Chief Executive Officer** | North Pole Enterprises | 324 AD - Present
*Global gift manufacturing and distribution conglomerate serving 2.6 billion customers annually*

**Operational Excellence:**
- Maintain 99.97% on-time delivery rate across 195 countries in single 24-hour operational window
- Manage global supply chain spanning all continents with zero carbon footprint (reindeer-powered logistics)
- Oversee manufacturing operations producing 2.6 billion+ customized products annually
- Developed and implemented real-time global tracking system monitoring behavior patterns of entire global population

**International Relations:**
- Established diplomatic immunity and operational agreements with all 195 UN member states
- Navigate complex airspace regulations and international borders with zero incidents
- Built trusted relationships with world leaders across all political systems and cultural backgrounds
- Maintain neutral political stance while operating in conflict zones and sanctioned territories

**Team Leadership:**
- Lead diverse workforce of 50,000+ elves across multiple time zones and operational departments
- Achieve 100% employee retention rate with industry-leading satisfaction scores
- Implement comprehensive training programs resulting in zero workplace injuries
- Foster inclusive culture celebrating differences while maintaining unified mission focus

**Technology & Innovation:**
- Pioneered magical technology integration with traditional manufacturing processes
- Developed sustainable transportation solutions achieving zero emissions across global operations
- Created advanced behavioral analytics platform with real-time global data processing
- Implemented predictive modeling systems for demand forecasting and resource allocation

### **Regional Operations Manager** | North Pole Enterprises | 4th Century AD - 324 AD
*European gift distribution and cultural integration specialist*

- Established foundational operational procedures still used in modern global operations
- Built strategic partnerships with local communities and regional leaders
- Developed signature red and white branding achieving 100% global brand recognition
- Created scalable operational model later expanded to global implementation

---

## Education & Professional Development

**University of Life & Global Experience**
- Doctorate Equivalent in International Relations (1,700+ years field experience)
- Master's Level Expertise in Logistics and Supply Chain Management
- Bachelor's Level Knowledge in Child Psychology and Cultural Anthropology

**Ongoing Professional Development:**
- Annual Strategic Planning Retreats with Mrs. Claus (Chief Strategy Officer)
- Continuous education in emerging technologies and cultural trends
- Regular consultation with international policy experts and child development specialists

---

## Key Achievements & Recognition

**Operational Milestones:**
- Successfully completed 1,700+ consecutive annual global operations without failure
- Maintained perfect safety record across all international flights and ground operations
- Achieved carbon-neutral operations centuries before sustainability became mainstream priority
- Built most trusted global brand with 100% positive recognition across all demographics

**Innovation Leadership:**
- Inventor of multiple transportation technologies including flying reindeer integration systems
- Pioneer in predictive analytics for behavioral assessment and gift personalization
- Developer of time-zone management protocols for synchronized global operations
- Creator of workshop automation systems achieving unprecedented production efficiency

**Cultural Impact:**
- Recognized as most beloved figure across all cultures, religions, and political systems
- Ambassador of joy, generosity, and childhood wonder to global population
- Successful cultural integration across diverse societies while maintaining core operational values

---

## Languages & Cultural Competencies

- **Languages:** All 7,100+ world languages (fluent)
- **Cultural Expertise:** Deep understanding of gift-giving traditions across all global cultures
- **Diplomatic Skills:** Proven ability to maintain political neutrality while operating globally
- **Crisis Management:** Expert in weather-related operational challenges and emergency response

---

## Security Clearances & Certifications

- **Global Access:** Unlimited airspace clearance in all 195 countries
- **Background Check:** Perfect record maintained for 1,700+ years
- **Behavioral Assessment Authority:** Exclusive "Naughty or Nice" global monitoring system
- **Emergency Response:** Certified for crisis management and disaster relief operations

---

## Board Positions & Affiliations

- **Founding Member:** International Council of Holiday Traditions
- **Board Chair:** Global Coalition for Childhood Joy and Wonder
- **Strategic Advisor:** United Nations Children's Emergency Fund (UNICEF)
- **Honorary Position:** International Association of Logistics Professionals

---

## Personal Philosophy

*"The best leaders serve others before themselves, and the greatest gift is bringing joy to those who need it most."*

---

**References Available Upon Request** *(Mrs. Claus, Head Elf, Rudolph, and billions of satisfied customers worldwide)*`

// US President Job Description Content
const US_PRESIDENT_JOB = `# President of the United States
**United States of America • Washington, DC**
*Full-time • Executive Level • Security Clearance Required*

Posted 1 day ago • 335,000,000 eligible applicants

---

## About the United States of America
For nearly 250 years, America has stood as a beacon of democracy, innovation, and opportunity. From pioneering the internet to landing on the moon, we've consistently pushed the boundaries of human achievement while championing freedom and equality.

Today, we face unprecedented global challenges that demand exceptional leadership. Climate change, technological disruption, geopolitical tensions, and evolving threats to democracy require a President who can unite our nation while navigating the most complex international landscape in generations.

---

## The Role
We seek a visionary Chief Executive to lead the United States through its most pivotal period since World War II. You'll command the world's largest economy ($26T GDP), most powerful military, and most influential democracy during an era of rapid technological and social transformation.

You will inherit a nation of extraordinary potential—with the world's leading technology companies, top universities, and most diverse population. Yet you'll also confront our most pressing challenges: political polarization, climate crisis, technological disruption of traditional industries, and maintaining American leadership in an increasingly multipolar world.

---

## Critical Strategic Priorities

### **AI & Technology Leadership**
- **Challenge**: Ensure America maintains technological supremacy against fierce competition, particularly from China in AI, semiconductors, and quantum computing
- **Opportunity**: Establish regulatory frameworks that foster innovation while protecting citizens from AI risks
- **Leadership Required**: Balance free market principles with national security imperatives and ethical AI development

### **Climate Crisis & Energy Independence**
- **Challenge**: Achieve net-zero emissions by 2050 while maintaining economic growth and energy security
- **Opportunity**: Lead the clean energy transition, creating millions of jobs while reducing dependence on fossil fuel imports
- **Leadership Required**: Unite diverse stakeholders around long-term climate action despite short-term political cycles

### **Democratic Institution Strengthening**
- **Challenge**: Restore faith in democratic institutions amid unprecedented polarization and misinformation campaigns
- **Opportunity**: Modernize government operations, improve transparency, and rebuild bipartisan cooperation
- **Leadership Required**: Rise above partisan politics while defending democratic norms and the rule of law

### **Global Leadership & Alliance Management**
- **Challenge**: Navigate complex relationships with allies and adversaries while managing multiple international crises
- **Opportunity**: Strengthen democratic alliances, counter authoritarian influence, and shape global governance for the 21st century
- **Leadership Required**: Project strength while building consensus, managing both carrots and sticks of American power

---

## Key Responsibilities

**Executive Leadership**
- Serve as Commander-in-Chief of armed forces across all branches and special operations
- Appoint and oversee 15 Cabinet secretaries and 4,000+ political appointees
- Execute congressional legislation while using executive authority to address urgent national priorities
- Represent America's values and interests in bilateral and multilateral negotiations with 190+ world leaders

**Crisis Management**
- Respond to natural disasters, pandemics, cyber attacks, and other emergencies affecting American citizens
- Make time-sensitive decisions with incomplete information under intense public scrutiny
- Coordinate federal, state, and local response efforts across all 50 states and territories
- Maintain calm and confident leadership during national and international crises

**Economic Stewardship**
- Oversee $6.8T federal budget and influence $26T national economy
- Work with Federal Reserve and Treasury to maintain economic stability and growth
- Balance competing priorities: inflation control, job creation, fiscal responsibility, and social programs
- Navigate trade relationships and supply chain challenges in globalized economy

**National Security**
- Protect homeland security while preserving civil liberties and constitutional rights
- Lead intelligence community across 18 agencies in identifying and countering emerging threats
- Make decisions regarding military intervention, sanctions, and diplomatic negotiations
- Safeguard classified information while maintaining transparent governance

---

## Required Qualifications

**Constitutional Requirements**
- Natural-born United States citizen
- Minimum age 35 years
- Resident of the United States for 14+ years

**Leadership Experience**
- 10+ years in senior executive roles managing large, complex organizations
- Proven ability to build coalitions across diverse stakeholder groups
- Experience making high-stakes decisions with national or international impact
- Track record of successful crisis management under public scrutiny

**Policy & Governance Expertise**
- Deep understanding of constitutional law, federal regulations, and separation of powers
- Knowledge of economic policy, national security, and international relations
- Experience working with legislative bodies, regulatory agencies, and judicial systems
- Familiarity with federal budget process and government operations

**Communication & Public Leadership**
- Exceptional public speaking and media relations skills
- Ability to communicate complex policy issues to diverse audiences
- Experience building public consensus around controversial topics
- Multilingual capabilities preferred (Spanish particularly valued)

---

## Preferred Qualifications
- Previous experience in elected office (Governor, Senator, Representative)
- Military service or national security experience
- Advanced degree in law, public policy, economics, or international relations
- Experience in private sector, non-profit leadership, or diplomatic service
- Demonstrated commitment to public service and democratic values

---

## What We Offer
- **Salary**: $400,000 annually (non-negotiable, set by congressional law)
- **Housing**: Fully furnished 132-room residence (The White House) with 24/7 staff support
- **Transportation**: Air Force One, Marine One helicopter, and armored ground transportation
- **Security**: Full Secret Service protection for you and immediate family
- **Legacy**: Opportunity to shape American history and influence global affairs for generations
- **Post-Service Benefits**: Lifetime Secret Service protection, federal pension, and presidential library

---

## Working Conditions
- **Hours**: 24/7 availability required, average 12-16 hour workdays
- **Travel**: Extensive domestic and international travel (Air Force One provided)
- **Public Scrutiny**: Every decision subject to intense media coverage and historical analysis
- **Term**: 4-year commitment with possibility of re-election for additional 4-year term
- **Start Date**: January 20, 2029 (Inauguration Day)

---

**To Apply:** Submit candidacy declaration, policy platform, and successfully complete nationwide electoral campaign including primaries, general election, and Electoral College confirmation.

**The United States Government is an Equal Opportunity Employer and does not discriminate on the basis of race, color, religion, sex, national origin, age, disability, or political affiliation.**`

// Custom Santa President Questions - 4 Best Questions
const SANTA_PRESIDENT_QUESTIONS = [
  "Hi Santa! What made you decide to run for President after all these years managing Christmas operations at the North Pole?",
  
  "You've successfully managed elves for centuries. How would you apply that experience to working with Congress and handling political disagreements?",
  
  "You know every child in the world through your naughty-or-nice system. What would you want American families to know about how you'd lead the country?",
  
  "Your philosophy is about being good versus naughty and bringing joy to others. How would these values guide your leadership style as President?"
]

export async function POST(request: NextRequest) {
  try {
    console.log('🎅 Santa President Demo: Starting demo creation...')

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

    console.log('🎅 User authenticated:', user.id)

    // Generate resume summary
    console.log('🤖 Generating resume summary...')
    const resumeSummaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Create a concise 150-word summary of this resume for voice interview context:\n\n${SANTA_CLAUS_RESUME}`
      }],
      max_tokens: 200,
      temperature: 0.3
    })

    const resumeSummary = resumeSummaryResponse.choices[0]?.message?.content || 'Santa Claus: CEO of North Pole Enterprises with 1,700+ years experience in global operations, logistics, and international relations.'

    // Generate job description summary  
    console.log('🇺🇸 Generating job description summary...')
    const jobSummaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Create a concise 150-word summary of this job description for voice interview context:\n\n${US_PRESIDENT_JOB}`
      }],
      max_tokens: 200,
      temperature: 0.3
    })

    const jobSummary = jobSummaryResponse.choices[0]?.message?.content || 'US President role: Lead the nation through technological transformation, climate challenges, and global diplomacy.'

    // Insert resume data
    console.log('📄 Inserting Santa Claus resume...')
    const { data: resumeData, error: resumeError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        filename: 'santa-claus-resume.md',
        file_url: 'demo://santa-claus-resume',
        parsed_content: SANTA_CLAUS_RESUME,
        parsed_summary: resumeSummary,
        file_size_bytes: SANTA_CLAUS_RESUME.length
      })
      .select()
      .single()

    if (resumeError) {
      console.error('Resume insertion error:', resumeError)
      return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 })
    }

    // Insert job description data
    console.log('🇺🇸 Inserting US President job description...')
    const { data: jobData, error: jobError } = await supabase
      .from('job_descriptions')
      .insert({
        user_id: user.id,
        url: 'https://government.usa.gov/president-2029',
        job_content: US_PRESIDENT_JOB,
        job_summary: jobSummary,
        company_name: 'United States of America',
        job_title: 'President of the United States'
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
        question_count: 4,
        demo_type: 'santa_president', // Mark as Santa demo
        status: 'pending'
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Session creation error:', sessionError)
      return NextResponse.json({ error: 'Failed to create interview session' }, { status: 500 })
    }

    // Insert custom Santa President questions
    console.log('❓ Inserting custom Santa President questions...')
    const questionInserts = SANTA_PRESIDENT_QUESTIONS.map((question, index) => ({
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

    console.log('✅ Santa President demo created successfully:', sessionData.id)

    return NextResponse.json({
      success: true,
      sessionId: sessionData.id,
      message: 'Santa President demo interview created successfully'
    })

  } catch (error) {
    console.error('Santa President demo creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
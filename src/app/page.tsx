export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">
          LickedIn Interviews
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          AI-Powered Mock Interview Platform
        </p>
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Coming Soon
          </h2>
          <p className="text-gray-600">
            Transform your interview preparation with real-time AI conversations,
            personalized feedback, and engaging interviewer personas.
          </p>
        </div>
      </div>
    </div>
  );
}

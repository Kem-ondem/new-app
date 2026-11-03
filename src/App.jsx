import { useState } from 'react'
import './App.css'

const courses = [
  { code: 'ENGR 161', title: 'Applied Mechanics', level: 'Level 100', department: 'Computer Engineering' },
  { code: 'ENGR 151', title: 'Applied Chemistry', level: 'Level 100', department: 'Computer Engineering' },
  { code: 'ENGR 141', title: 'Engineering Technology', level: 'Level 100', department: 'Computer Engineering' },
  { code: 'GSEL 131', title: 'Communication Skills I', level: 'Level 100', department: 'Computer Engineering' },
  { code: 'ENCE 131', title: 'Principles of Programming', level: 'Level 100', department: 'Computer Engineering' },
  { code: 'ENGR 121', title: 'Applied Physics', level: 'Level 100', department: 'Computer Engineering' },
  { code: 'MATH 111', title: 'Engineering Mathematics I (Linear Algebra & Differentiation)', level: 'Level 100', department: 'Computer Engineering' },
  { code: 'GSFF 121', title: 'Functional French', level: 'Level 100', department: 'Computer Engineering' },
]

function App() {
  const [indexNumber, setIndexNumber] = useState('')
  const [hasEntered, setHasEntered] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCourse, setSelectedCourse] = useState(null)

  const filteredCourses = courses.filter((course) =>
    `${course.code} ${course.title} ${course.level} ${course.department}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  function handleSubmit(event) {
    event.preventDefault()

    if (indexNumber.trim()) {
      setHasEntered(true)
    }
  }

  function handleLogout() {
    setHasEntered(false)
    setIndexNumber('')
    setSearch('')
    setSelectedCourse(null)
  }

  return (
    <main className="page">
      <header className="header">
        <img className="logo" src="/gctu-logo.png" alt="GCTU logo" />
        <span>GCTU Course Library</span>

        {hasEntered && (
          <button className="back-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        )}
      </header>

      {!hasEntered ? (
        <section className="landing-card">
          <div className="book-animation" aria-hidden="true">
            <div className="book-glow"></div>
            <div className="book">
              <div className="book-pages"></div>
              <div className="book-cover">
                <span>
                  GCTU
                  <br />
                  COURSE
                  <br />
                  LIBRARY
                </span>
              </div>
            </div>
          </div>

          <p className="eyebrow">STUDENT RESOURCE HUB</p>
          <h1>Welcome to the GCTU Course Library</h1>
          <p className="description">
            Enter your index number to continue to your course materials.
          </p>

          <form className="index-form" onSubmit={handleSubmit}>
            <label htmlFor="indexNumber">Index number</label>
            <input
              id="indexNumber"
              type="text"
              placeholder="Enter your index number"
              value={indexNumber}
              onChange={(event) => setIndexNumber(event.target.value)}
              autoComplete="off"
              required
            />
            <button className="continue-button" type="submit">
              Continue
            </button>
          </form>
        </section>
      ) : selectedCourse ? (
        <section className="course-details">
          <button
            className="back-to-courses"
            type="button"
            onClick={() => setSelectedCourse(null)}
          >
            ← Back to courses
          </button>

          <p className="eyebrow">COURSE DETAILS</p>
          <span className="course-code">{selectedCourse.code}</span>
          <h1>{selectedCourse.title}</h1>

          <div className="course-info">
            <div>
              <span className="info-label">Department</span>
              <strong>{selectedCourse.department}</strong>
            </div>
            <div>
              <span className="info-label">Level</span>
              <strong>{selectedCourse.level}</strong>
            </div>
          </div>

          <div className="course-content-grid">
            <section className="content-panel">
              <span className="panel-number">01</span>
              <h2>Course Outline</h2>
              <p>View the topics and learning objectives for this course.</p>
              <div className="content-placeholder">
                The course outline will appear here when it is added.
              </div>
            </section>

            <section className="content-panel">
              <span className="panel-number">02</span>
              <h2>Resources</h2>
              <p>Find lecture notes, slides, and other study materials.</p>
              <div className="content-placeholder">
                Course resources will appear here when they are added.
              </div>
            </section>

            <section className="content-panel">
              <span className="panel-number">03</span>
              <h2>Past Questions</h2>
              <p>Practise with questions from previous exams.</p>
              <div className="content-placeholder">
                Past questions will appear here when they are added.
              </div>
            </section>
          </div>
        </section>
      ) : (
        <>
          <section className="intro">
            <p className="eyebrow">STUDENT RESOURCE HUB</p>
            <h1>Your course library.</h1>
            <p className="description">
              Search the library for courses and resources to support your studies.
            </p>

            <input
              className="search"
              type="search"
              placeholder="Search by course code, title, or department..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </section>

          <section className="course-section">
            <h2>Available courses</h2>

            <div className="course-grid">
              {filteredCourses.map((course) => (
                <button
                  className="course-card"
                  key={course.code}
                  type="button"
                  onClick={() => setSelectedCourse(course)}
                >
                  <span className="course-code">{course.code}</span>
                  <h3>{course.title}</h3>
                  <p>{course.department}</p>
                  <span className="level">{course.level}</span>
                  <span className="card-link">View course →</span>
                </button>
              ))}
            </div>

            {filteredCourses.length === 0 && (
              <p className="empty">No courses match that search.</p>
            )}
          </section>
        </>
      )}
    </main>
  )
}

export default App
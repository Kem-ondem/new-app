import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { courseSources, courses, programmeOptions } from './courseCatalog'
import './App.css'

const STUDENT_EMAIL_DOMAIN = 'live.gctu.edu.gh'

function normalizeIndexNumber(value) {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

function getStudentEmail(indexNumber) {
  return `${normalizeIndexNumber(indexNumber).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`
}

function getCourseId(course) {
  return `${course.code}-${course.programme}-${course.level}-${course.semester}`
}

function App() {
  const [indexNumber, setIndexNumber] = useState('')
  const [hasEntered, setHasEntered] = useState(false)
  const [authStep, setAuthStep] = useState('index')
  const [otp, setOtp] = useState('')
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [search, setSearch] = useState('')
  const [programmeFilter, setProgrammeFilter] = useState('BSc. Computer Engineering')
  const [levelFilter, setLevelFilter] = useState('Level 100')
  const [semesterFilter, setSemesterFilter] = useState('Semester 1')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [userId, setUserId] = useState(null)
  const [savedCourses, setSavedCourses] = useState([])
  const [progressByCourse, setProgressByCourse] = useState({})
  const [resourcesByCourse, setResourcesByCourse] = useState({})
  const [commentsByCourse, setCommentsByCourse] = useState({})
  const [resourceTitle, setResourceTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [hasScrolledLibrary, setHasScrolledLibrary] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setHasScrolledLibrary(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email?.toLowerCase() ?? ''
      setUserId(session?.user?.id ?? null)
      const studentEmailSuffix = `@${STUDENT_EMAIL_DOMAIN}`
      const isStudentSession = email.endsWith(studentEmailSuffix)

      setHasEntered(isStudentSession)

      if (isStudentSession) {
        setIndexNumber(
          email.slice(0, -studentEmailSuffix.length).toUpperCase()
        )
      } else if (!session) {
        setIndexNumber('')
        setSelectedCourse(null)
        setShowProfile(false)
        setProgrammeFilter('BSc. Computer Engineering')
        setLevelFilter('Level 100')
        setSemesterFilter('Semester 1')
        setSavedCourses([])
        setProgressByCourse({})
        setResourcesByCourse({})
        setCommentsByCourse({})
      }

      setCheckingSession(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    async function loadStudentLibrary() {
      const [savedResult, progressResult] = await Promise.all([
        supabase.from('saved_courses').select('course_key').eq('user_id', userId),
        supabase.from('course_progress').select('course_key, progress').eq('user_id', userId),
      ])

      if (savedResult.error || progressResult.error) {
        setAuthError('Could not load your saved courses. Refresh and try again.')
        return
      }

      setSavedCourses((savedResult.data || []).map((item) => item.course_key))
      setProgressByCourse(
        Object.fromEntries((progressResult.data || []).map((item) => [item.course_key, item.progress]))
      )
    }

    loadStudentLibrary()
  }, [userId])

  useEffect(() => {
    if (!selectedCourse) return

    const courseKey = getCourseId(selectedCourse)

    async function loadCourseCommunity() {
      const [resourceResult, commentResult] = await Promise.all([
        supabase
          .from('course_resources')
          .select('id, title, file_path, file_name, file_size, created_by, created_at')
          .eq('course_key', courseKey)
          .order('created_at', { ascending: false }),
        supabase
          .from('course_comments')
          .select('id, message, created_by, created_at')
          .eq('course_key', courseKey)
          .order('created_at', { ascending: false }),
      ])

      if (resourceResult.error || commentResult.error) {
        setAuthError('Could not load course resources and comments. Refresh and try again.')
        return
      }

      setResourcesByCourse((current) => ({ ...current, [courseKey]: resourceResult.data || [] }))
      setCommentsByCourse((current) => ({ ...current, [courseKey]: commentResult.data || [] }))
    }

    loadCourseCommunity()
  }, [selectedCourse])

  const availableLevels = [...new Set(
    courses
      .filter((course) => programmeFilter === 'all' || course.programme === programmeFilter)
      .map((course) => course.level)
  )].sort()

  const availableSemesters = [...new Set(
    courses
      .filter((course) => programmeFilter === 'all' || course.programme === programmeFilter)
      .filter((course) => levelFilter === 'all' || course.level === levelFilter)
      .map((course) => course.semester)
  )].sort()

  const filteredCourses = courses.filter((course) => {
    const matchesProgramme =
      programmeFilter === 'all' || course.programme === programmeFilter
    const matchesLevel = levelFilter === 'all' || course.level === levelFilter
    const matchesSemester = semesterFilter === 'all' || course.semester === semesterFilter
    const searchText = `${course.code} ${course.title} ${course.programme} ${course.level} ${course.semester} ${course.academicYear}`

    return (
      matchesProgramme &&
      matchesLevel &&
      matchesSemester &&
      searchText.toLowerCase().includes(search.toLowerCase())
    )
  })

  async function requestCode(indexValue, isResend = false) {
    const normalizedIndex = normalizeIndexNumber(indexValue)

    setAuthError('')
    setAuthMessage('')

    if (!normalizedIndex) {
      setAuthError('Enter your index number first.')
      return
    }

    if (normalizedIndex.includes('@')) {
      setAuthError('Enter your index number only, not an email address.')
      return
    }

    setLoading(true)

    try {
      const email = getStudentEmail(normalizedIndex)
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      })

      if (error) {
        setAuthError(error.message)
        return
      }

      setIndexNumber(normalizedIndex)
      setAuthStep('code')
      setOtp('')
      setAuthMessage(
        isResend
          ? 'A new code was requested. Check the GCTU student email for this index number.'
          : 'Check the GCTU student email for this index number for your six-digit code.'
      )
    } catch (error) {
      setAuthError(error.message || 'Could not send the code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleIndexSubmit(event) {
    event.preventDefault()
    await requestCode(indexNumber)
  }

  async function handleVerifyCode(event) {
    event.preventDefault()

    const normalizedIndex = normalizeIndexNumber(indexNumber)
    const token = otp.trim()

    setAuthError('')
    setAuthMessage('')

    if (!/^\d{6}$/.test(token)) {
      setAuthError('Enter the six-digit code from your email.')
      return
    }

    setLoading(true)

    try {
      const email = getStudentEmail(normalizedIndex)
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      })

      if (error) {
        setAuthError(error.message)
        return
      }

      const verifiedEmail =
        data.user?.email ?? data.session?.user?.email ?? ''

      if (
        !data.session ||
        !verifiedEmail.toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`)
      ) {
        setAuthError(
          'The code did not create a GCTU student session. Request a new code and try again.'
        )
        return
      }

      setIndexNumber(normalizedIndex)
      setHasEntered(true)
      setAuthStep('index')
      setOtp('')
      setShowProfile(false)
      setAuthMessage('')
      setAuthError('')
    } catch (error) {
      setAuthError(error.message || 'Could not verify the code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleUseAnotherIndex() {
    setAuthStep('index')
    setIndexNumber('')
    setOtp('')
    setAuthError('')
    setAuthMessage('')
  }

  function handleToggleProfile() {
    setSelectedCourse(null)
    setShowProfile((current) => !current)
  }

  async function toggleSavedCourse(course) {
    if (!userId) return

    const courseId = getCourseId(course)
    const isSaved = savedCourses.includes(courseId)
    const { error } = isSaved
      ? await supabase.from('saved_courses').delete().eq('user_id', userId).eq('course_key', courseId)
      : await supabase.from('saved_courses').insert({ user_id: userId, course_key: courseId })

    if (error) {
      setAuthError('Could not update your saved courses. Please try again.')
      return
    }

    setSavedCourses((current) => isSaved ? current.filter((id) => id !== courseId) : [...current, courseId])
  }

  async function updateProgress(value) {
    if (!selectedCourse || !userId) return

    const courseKey = getCourseId(selectedCourse)
    const progress = Number(value)
    setProgressByCourse((current) => ({ ...current, [courseKey]: progress }))

    const { error } = await supabase.from('course_progress').upsert(
      { user_id: userId, course_key: courseKey, progress, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,course_key' }
    )

    if (error) {
      setAuthError('Could not save your progress. Please try again.')
    }
  }

  async function handleResourceAdd(event) {
    event.preventDefault()
    if (!selectedCourse || !selectedFile) return

    const courseId = getCourseId(selectedCourse)
    if (!userId) return

    const cleanFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const filePath = `${userId}/${Date.now()}-${cleanFileName}`
    const { error: uploadError } = await supabase.storage
      .from('course-resources')
      .upload(filePath, selectedFile)

    if (uploadError) {
      setAuthError(uploadError.message)
      return
    }

    const { data: resource, error: resourceError } = await supabase
      .from('course_resources')
      .insert({
        course_key: courseId,
        title: resourceTitle.trim() || selectedFile.name,
        file_path: filePath,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        created_by: userId,
      })
      .select('id, title, file_path, file_name, file_size, created_by, created_at')
      .single()

    if (resourceError) {
      await supabase.storage.from('course-resources').remove([filePath])
      setAuthError(resourceError.message)
      return
    }

    setResourcesByCourse((current) => ({ ...current, [courseId]: [resource, ...(current[courseId] || [])] }))
    setResourceTitle('')
    setSelectedFile(null)
    event.currentTarget.reset()
  }

  async function handleCommentAdd(event) {
    event.preventDefault()
    const message = commentText.trim()
    if (!selectedCourse || !message) return

    const courseId = getCourseId(selectedCourse)
    if (!userId) return

    const { data: comment, error } = await supabase
      .from('course_comments')
      .insert({ course_key: courseId, message, created_by: userId })
      .select('id, message, created_by, created_at')
      .single()

    if (error) {
      setAuthError(error.message)
      return
    }

    setCommentsByCourse((current) => ({ ...current, [courseId]: [comment, ...(current[courseId] || [])] }))
    setCommentText('')
  }

  async function downloadResource(resource) {
    const { data, error } = await supabase.storage
      .from('course-resources')
      .createSignedUrl(resource.file_path, 60)

    if (error) {
      setAuthError('Could not open this resource. Please try again.')
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleLogout() {
    setLoading(true)
    setAuthError('')

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        setAuthError(error.message)
        return
      }

      setHasEntered(false)
      setAuthStep('index')
      setIndexNumber('')
      setOtp('')
      setSearch('')
      setSelectedCourse(null)
      setShowProfile(false)
      setAuthMessage('')
    } catch (error) {
      setAuthError(error.message || 'Could not log out. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page">
      <header className="header" style={{ flexWrap: 'wrap' }}>
        <img className="logo" src="/gctu-logo.png" alt="GCTU logo" />
        <span>GCTU Course Library</span>

        {hasEntered && (
          <div className="header-actions">
            <button
              className="header-icon-button"
              type="button"
              onClick={handleToggleProfile}
              disabled={loading}
              aria-label={showProfile ? 'View courses' : 'View profile'}
              title={showProfile ? 'Courses' : 'Profile'}
            >
              {showProfile ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
                </svg>
              )}
            </button>

            <button
              className="header-icon-button logout-icon"
              type="button"
              onClick={handleLogout}
              disabled={loading}
              aria-label={loading ? 'Logging out' : 'Log out'}
              title={loading ? 'Logging out...' : 'Log out'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
                <path d="M14 16l4-4-4-4M18 12H9" />
              </svg>
            </button>
          </div>
        )}
      </header>

      {hasEntered && authError && (
        <p
          role="alert"
          style={{ color: '#b42318', marginTop: '16px' }}
        >
          {authError}
        </p>
      )}

      {checkingSession ? (
        <section className="landing-card">
          <p className="description">Checking your sign-in...</p>
        </section>
      ) : !hasEntered ? (
        <section className="landing-card landing-scene">
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
            Enter your index number to receive a sign-in code at your GCTU
            student email.
          </p>

          {authStep === 'index' ? (
            <form className="index-form" onSubmit={handleIndexSubmit}>
              <label htmlFor="indexNumber">Index number</label>
              <input
                id="indexNumber"
                type="text"
                placeholder="Enter your index number"
                value={indexNumber}
                onChange={(event) => {
                  setIndexNumber(event.target.value)
                  setAuthError('')
                  setAuthMessage('')
                }}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck="false"
                required
                disabled={loading}
              />

              {authError && (
                <p
                  role="alert"
                  style={{ color: '#b42318', margin: '4px 0' }}
                >
                  {authError}
                </p>
              )}

              {authMessage && (
                <p
                  role="status"
                  style={{
                    color: 'var(--muted)',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    margin: '4px 0',
                  }}
                >
                  {authMessage}
                </p>
              )}

              <button
                className="continue-button"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Sending code...' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form className="index-form" onSubmit={handleVerifyCode}>
              <label htmlFor="studentCode">Six-digit verification code</label>
              <input
                id="studentCode"
                type="text"
                placeholder="Enter the code from your email"
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                  setAuthError('')
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                disabled={loading}
                autoFocus
              />

              {authMessage && (
                <p
                  role="status"
                  style={{
                    color: 'var(--muted)',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    margin: '4px 0',
                  }}
                >
                  {authMessage}
                </p>
              )}

              {authError && (
                <p
                  role="alert"
                  style={{ color: '#b42318', margin: '4px 0' }}
                >
                  {authError}
                </p>
              )}

              <button
                className="continue-button"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify code'}
              </button>

              <button
                className="back-button"
                type="button"
                onClick={() => requestCode(indexNumber, true)}
                disabled={loading}
              >
                Resend code
              </button>

              <button
                className="back-button"
                type="button"
                onClick={handleUseAnotherIndex}
                disabled={loading}
              >
                Use a different index number
              </button>
            </form>
          )}
        </section>
      ) : showProfile ? (
        <section className="course-details screen-enter">
          <button
            className="back-to-courses"
            type="button"
            onClick={() => setShowProfile(false)}
          >
            ← Back to courses
          </button>

          <p className="eyebrow">STUDENT ACCOUNT</p>
          <h1>My profile</h1>
          <p className="description">
            These are the account details used to sign in to the course library.
          </p>

          <div className="course-info">
            <div>
              <span className="info-label">Index number</span>
              <strong>{indexNumber}</strong>
            </div>

            <div>
              <span className="info-label">GCTU student email</span>
              <strong style={{ overflowWrap: 'anywhere' }}>
                {getStudentEmail(indexNumber)}
              </strong>
            </div>

            <div>
              <span className="info-label">Sign-in status</span>
              <strong>Email confirmed</strong>
            </div>
          </div>

          <section
            className="content-panel"
            style={{ maxWidth: '560px', minHeight: 'auto' }}
          >
            <span className="panel-number">ACCOUNT</span>
            <h2>Your account is signed in</h2>
            <p>
              A verification code was sent to the GCTU email address shown
              above and confirmed for this session.
            </p>
          </section>
        </section>
      ) : selectedCourse ? (
        <section className="course-details screen-enter">
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

          <div className="course-actions">
            <button
              className={`save-course-button ${savedCourses.includes(getCourseId(selectedCourse)) ? 'is-saved' : ''}`}
              type="button"
              onClick={() => toggleSavedCourse(selectedCourse)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 3.5h12v17l-6-3.8-6 3.8v-17Z" />
              </svg>
              {savedCourses.includes(getCourseId(selectedCourse)) ? 'Saved to my courses' : 'Save course'}
            </button>
          </div>

          <div className="course-info">
            <div>
              <span className="info-label">Programme</span>
              <strong>{selectedCourse.programme}</strong>
            </div>
            <div>
              <span className="info-label">Level</span>
              <strong>{selectedCourse.level}</strong>
            </div>
            <div>
              <span className="info-label">Semester</span>
              <strong>{selectedCourse.semester}</strong>
            </div>
            <div>
              <span className="info-label">Schedule year</span>
              <strong>{selectedCourse.academicYear}</strong>
            </div>
            <div>
              <span className="info-label">Course source</span>
              <strong>
                <a
                  href={courseSources[selectedCourse.sourceKey]?.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {courseSources[selectedCourse.sourceKey]?.label || 'GCTU schedule'}
                </a>
              </strong>
            </div>
          </div>

          <section className="learning-progress" aria-label="Course progress">
            <div>
              <span className="panel-number">YOUR PROGRESS</span>
              <h2>{progressByCourse[getCourseId(selectedCourse)] || 0}% complete</h2>
              <p>Move the slider as you work through this course.</p>
            </div>
            <div className="progress-control">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progressByCourse[getCourseId(selectedCourse)] || 0}
                onChange={(event) => updateProgress(event.target.value)}
                aria-label={`Progress for ${selectedCourse.title}`}
              />
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: `${progressByCourse[getCourseId(selectedCourse)] || 0}%` }}></span>
              </div>
            </div>
          </section>

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
              <p>Share a file name and resource title with your study list.</p>
              <form className="resource-form" onSubmit={handleResourceAdd}>
                <input
                  type="text"
                  placeholder="Resource title (optional)"
                  value={resourceTitle}
                  onChange={(event) => setResourceTitle(event.target.value)}
                />
                <input
                  type="file"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  required
                />
                <button className="small-action-button" type="submit">Add resource</button>
              </form>
              {(resourcesByCourse[getCourseId(selectedCourse)] || []).length > 0 ? (
                <ul className="resource-list">
                  {(resourcesByCourse[getCourseId(selectedCourse)] || []).map((resource) => (
                    <li key={resource.id}>
                      <strong>{resource.title}</strong>
                      <span>{resource.file_name} · shared by {resource.created_by === userId ? 'you' : 'a GCTU student'}</span>
                      <button
                        className="resource-download"
                        type="button"
                        onClick={() => downloadResource(resource)}
                      >
                        Open resource
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="content-placeholder">Be the first to add a resource.</div>
              )}
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

          <section className="comments-panel">
            <span className="panel-number">DISCUSSION</span>
            <h2>Study conversation</h2>
            <p>Ask a question or share a helpful study tip for this course.</p>
            <form className="comment-form" onSubmit={handleCommentAdd}>
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentText}
                maxLength="240"
                onChange={(event) => setCommentText(event.target.value)}
                required
              />
              <button className="small-action-button" type="submit">Post</button>
            </form>
            {(commentsByCourse[getCourseId(selectedCourse)] || []).length > 0 ? (
              <div className="comment-list">
                {(commentsByCourse[getCourseId(selectedCourse)] || []).map((comment) => (
                  <article key={comment.id} className="comment-item">
                    <strong>{comment.created_by === userId ? 'You' : 'GCTU student'}</strong>
                    <p>{comment.message}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="content-placeholder">No comments yet. Start the discussion.</p>
            )}
          </section>
        </section>
      ) : (
        <div className={`screen-enter library-journey ${hasScrolledLibrary ? 'is-unfolded' : ''}`}>
          <section className="intro library-hero">
            <p className="eyebrow">STUDENT RESOURCE HUB</p>
            <h1>Your course library.</h1>
            <p className="description">
              Search the library for courses and resources to support your
              studies.
            </p>
            <p className="catalog-note">
              Choose a programme, level, and semester. Course entries come from
              published GCTU schedules; confirm your registered courses in SIP.
            </p>

            <input
              className="search"
              type="search"
              placeholder="Search by course code, title, or programme..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="catalog-filters">
              <label className="catalog-filter">
                <span>Programme</span>
                <select
                  value={programmeFilter}
                  onChange={(event) => {
                    setProgrammeFilter(event.target.value)
                    setLevelFilter('all')
                    setSemesterFilter('all')
                  }}
                >
                  <option value="all">All programmes</option>
                  {programmeOptions.map((programme) => (
                    <option key={programme} value={programme}>{programme}</option>
                  ))}
                </select>
              </label>

              <label className="catalog-filter">
                <span>Level</span>
                <select
                  value={levelFilter}
                  onChange={(event) => {
                    setLevelFilter(event.target.value)
                    setSemesterFilter('all')
                  }}
                >
                  <option value="all">All levels</option>
                  {availableLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>

              <label className="catalog-filter">
                <span>Semester</span>
                <select
                  value={semesterFilter}
                  onChange={(event) => setSemesterFilter(event.target.value)}
                >
                  <option value="all">All semesters</option>
                  {availableSemesters.map((semester) => (
                    <option key={semester} value={semester}>{semester}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="course-section library-reveal">
            <h2>Available courses ({filteredCourses.length})</h2>

            <div className="course-grid">
              {filteredCourses.map((course) => {
                const isSaved = savedCourses.includes(getCourseId(course))
                const courseProgress = progressByCourse[getCourseId(course)] || 0

                return (
                <article
                  className="course-card"
                  key={`${course.code}-${course.programme}-${course.level}-${course.semester}-${course.sourceKey}`}
                >
                  <button
                    className="course-card-open"
                    type="button"
                    onClick={() => setSelectedCourse(course)}
                  >
                    <span className="course-code">{course.code}</span>
                    <h3>{course.title}</h3>
                    <p>{course.programme}</p>
                    <span className="level">{course.level} · {course.semester}</span>
                    <span className="info-label">Schedule: {course.academicYear}</span>
                    {courseProgress > 0 && <span className="card-progress">{courseProgress}% complete</span>}
                    <span className="card-link">View course →</span>
                  </button>
                  <button
                    className={`bookmark-button ${isSaved ? 'is-saved' : ''}`}
                    type="button"
                    onClick={() => toggleSavedCourse(course)}
                    aria-label={isSaved ? `Remove ${course.title} from saved courses` : `Save ${course.title}`}
                    title={isSaved ? 'Remove from saved courses' : 'Save course'}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 3.5h12v17l-6-3.8-6 3.8v-17Z" />
                    </svg>
                  </button>
                </article>
                )
              })}
            </div>

            {filteredCourses.length === 0 && (
              <p className="empty">
                No course schedule entries match those filters. Try another programme, level, or semester.
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

export default App

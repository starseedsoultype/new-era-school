// Where "> next lesson" goes. Reads only: asks the server which lesson is next (closed sessions + 1).
// Returns the page address, or null when there is no next lesson yet (or it is the lesson just finished).
export async function nextLessonPage(api, currentLessonId) {
  const today = await api.session("today");
  if (!today?.lesson_id || today.lesson_id === currentLessonId) return null;
  return "lesson.html";
}

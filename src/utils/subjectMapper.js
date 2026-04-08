export const getSubjectName = (courseCode) => {
  if (!courseCode) return "";
  
  // Remove time pattern if present (e.g. "07:10-08:00 ")
  const cleanCode = courseCode.replace(/^\d{2}:\d{2}-\d{2}:\d{2}\s+/, '').trim();
  
  // Extract base code (e.g., 24AD01HF -> 24AD01HF)
  const baseCode = cleanCode.split(' ')[0].trim();

  
  try {
    const mappings = JSON.parse(localStorage.getItem("subjectMappings") || "{}");
    return mappings[baseCode] || courseCode;
  } catch (e) {
    console.error("Failed to parse subject mappings", e);
    return courseCode;
  }
};

export const replaceCourseCodeWithCustomName = (content) => {
  if (!content) return "";
  
  // Identify the course code part (e.g., "24AD01HF - S-6")
  const parts = content.split(' - ');
  const courseCode = parts[0].trim();
  
  const customName = getSubjectName(courseCode);
  
  // Return mapping + the extra info like Room/Section if present
  if (parts.length > 1) {
    return `${customName} - ${parts.slice(1).join(' - ')}`;
  }
  
  return customName;
};

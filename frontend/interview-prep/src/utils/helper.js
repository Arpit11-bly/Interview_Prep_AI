export const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const validatePassword = (password) => {
  return String(password || "").length >= 8;
};


// ye validation jo h role ke first two words ko title bna dega

export const getInitials = (title) =>{
  if(!title) return "";

  const words = title.split(" ");
  let initials = "";

  for(let i= 0; i<Math.min(words.length, 2); i++){
    initials += words[i][0];
  }
  return initials.toUpperCase();
}

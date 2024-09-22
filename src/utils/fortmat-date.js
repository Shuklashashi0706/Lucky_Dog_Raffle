const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  const formattedDate = `${day}-${month}-${year} ${hours}:${minutes}`;

  return formattedDate;
};

const formatTime = (input) => {
  const currentTime = Math.floor(Date.now() / 1000);

  const dayMatch = input.match(/(\d+)d/);
  const hourMatch = input.match(/(\d+)h/);

  const days = dayMatch ? parseInt(dayMatch[1]) : 0;
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;

  const totalSeconds = days * 24 * 60 * 60 + hours * 60 * 60;

  const futureUnixTime = currentTime + totalSeconds;

  return futureUnixTime;
};
export { formatDate, formatTime };

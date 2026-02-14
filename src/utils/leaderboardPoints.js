exports.getNormalizeMultiplier = (followersCount) => {  
  if (followersCount >= 100000) return 0.6;
  if (followersCount >= 75000) return 0.7;
  if (followersCount >= 50000) return 0.8;
  if (followersCount >= 25000) return 0.9;
  return 1;
};

exports.getPremiumPoints = (followersCount) => {
  if (followersCount >= 200000) return 150;
  if (followersCount >= 100000) return 100;
  if (followersCount >= 75000) return 50;
  if (followersCount >= 50000) return 25;
  return 0;
};

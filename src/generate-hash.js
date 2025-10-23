import bcrypt from "bcryptjs";

const generateHash = async () => {
  const password = "senha123";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  console.log("--- SEU HASH CORRETO ---");
  console.log(hash);
  console.log("---------------------------");
};

generateHash();

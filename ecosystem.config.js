
module.exports = {
  apps: [
    {
      name: "wanzz-ppob",
      script: "server.js",
      instances: "max", // Menggunakan semua core CPU yang tersedia di VPS
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000 // Ganti port ini sesuai keinginan Anda
      }
    }
  ]
};

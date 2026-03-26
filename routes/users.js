var express = require("express");
var router = express.Router();
let { validatedResult, CreateUserValidator, ModifyUserValidator } = require("../utils/validator")
let userModel = require("../schemas/users");
let roleModel = require("../schemas/roles");
let userController = require("../controllers/users");
const { checkLogin,checkRole } = require("../utils/authHandler");
let { sendMail } = require("../utils/mailHandler");
let { uploadExcel } = require("../utils/uploadHandler");
let excelJs = require("exceljs");
let path = require("path");
let crypto = require("crypto");


router.get("/", checkLogin,checkRole("ADMIN","MODERATOR"), async function (req, res, next) {
  let users = await userModel
    .find({ isDeleted: false })
  res.send(users);
});

router.get("/:id", async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateUserValidator, validatedResult, async function (req, res, next) {
  try {
    let roleId = req.body.role;
    if (!roleId) {
      let defaultRole = await roleModel.findOne({ name: 'user', isDeleted: false });
      roleId = defaultRole ? defaultRole._id : null;
    }
    let newUser = await userController.CreateAnUser(
      req.body.username,
      req.body.password,
      req.body.email,
      roleId,
      null,
      req.body.fullname,
      req.body.avatarUrl
    )
    res.send(newUser);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get("/import", checkLogin, checkRole("ADMIN", "MODERATOR"), function (req, res, next) {
  res.send({
    message: "Sử dụng POST /api/v1/users/import với form-data key 'file' chứa file Excel (username, email).",
    example: "curl -F 'file=@users.xlsx' http://localhost:3000/api/v1/users/import"
  });
});

router.post("/import", async function (req, res, next) {
  uploadExcel.single("file")(req, res, async function (err) {
    if (err) {
      return res.status(400).send({ message: err.message || "File upload error" });
    }
    if (!req.file) {
      return res.status(400).send({ message: "No file uploaded" });
    }

    try {
      let roleUser = await roleModel.findOne({ name: "user", isDeleted: false });
      const workbook = new excelJs.Workbook();
      const filePath = path.join(__dirname, "../uploads", req.file.filename);
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];

      let result = [];

      for (let index = 2; index <= worksheet.rowCount; index++) {
        const row = worksheet.getRow(index);
        let username = (row.getCell(1).value || "").toString().trim();
        let email = (row.getCell(2).value || "").toString().trim().toLowerCase();

        if (!username || !email) {
          result.push({ row: index, success: false, message: "username va email la bat buoc" });
          continue;
        }

        let existing = await userModel.findOne({ $or: [{ username }, { email }] });
        if (existing) {
          result.push({ row: index, success: false, message: "username hoac email da ton tai" });
          continue;
        }

        let password = crypto.randomBytes(12).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
        while (password.length < 16) {
          password += crypto.randomBytes(1).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
          password = password.slice(0, 16);
        }

        let newUser = await userController.CreateAnUser(
          username,
          password,
          email,
          roleUser ? roleUser._id : null,
        );

        await sendMail(
          email,
          "Thông tin tài khoản",
          `Chào ${username},\nTài khoản đã được tạo.\nEmail: ${email}\nPassword: ${password}`,
          `<p>Chào ${username},</p><p>Tài khoản của bạn đã được tạo.</p><ul><li>Email: ${email}</li><li>Password: ${password}</li></ul>`
        );

        result.push({ row: index, success: true, username, email });
      }

      res.send(result);
    } catch (err) {
      res.status(400).send({ message: err.message });
    }
  });
});

router.put("/:id", ModifyUserValidator, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
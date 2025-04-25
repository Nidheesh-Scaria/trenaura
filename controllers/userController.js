const userSchmea = require("../models/userSchema");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const nodeMailer=require('nodemailer')
const env=require('dotenv').config();


function generateOtp(){
  return Math.floor(100000 + Math.random()*900000).toString()
}


async function sendVerificationEmail(email,otp) {
  try {
    const tranporter=nodeMailer.createTransport({

      service:'gmail',
      port:587,
      secure:false,
      requireTLS:true,
      auth:{
        user:process.env.NODEMAILER_EMAIL,
        pass:process.env.NODEMAILER_PASSWORD
        
      }, 


    })

    const info = await tranporter.sendMail({
      from:process.env.NODEMAILER_EMAIL,
      to:email,
      subject:"Verify your Trenaura account",
      text:`Your otp is ${otp}`,
      htmll:`<b> Your Otp:${otp}</b>`
    })

    return info.accepted.length > 0



  } catch (error) {
    console.error("Error sending email",error)
    return false;
  }
  
} 




const signup = async (req, res) => {
  try {
    let { name, email, phone, password } = req.body;

    const user = await userSchmea.findOne({ email });
    const phoneNumber = await userSchmea.findOne({ phone });
    if (user || phoneNumber) {
      return res.redirect(
        "/signup?message=" +
          encodeURIComponent(
            "Email or phone number already in use. Please use a different one."
          ) +
          "&t=" +
          Date.now()
      );
    } 

    const otp=generateOtp();
    const emailSent=await sendVerificationEmail(email,otp);
    if(!emailSent){
      return res.json("email-error")
    }
    req.session.userOtp=otp;
    req.session.userData={name, email, phone, password}
    res.redirect('/veryfyOtp')
    console.log("Otp Sent:",otp)
 
  } catch (error) {
    console.error("Error in signup", error);
    res.status(500).send("Internal server error");
    res.redirect('/pageNotFound')
  }
};

const veryfySignupOtp=async(req,res)=>{
  try {
    const {otp}=req.body
    console.log("Entered Otp: ",otp)
    console.log("Session OTP:",req.session.userOtp)

    if(String(otp) === String(req.session.userOtp)){

      const user=req.session.userData
      const hashedPassword = await bcrypt.hash(user.password, saltRounds);

      const saveUserData = new userSchmea({
          name:user.name,
          email:user.email,
          phone:user.phone,
          password: hashedPassword,
        });

        await saveUserData.save();
        req.session.user=saveUserData._id;
        req.session.user=true;
        res.json({success:true,redirectUrl:"/"})

    }else{
      res.status(400).json({success:false,message:"Invalid OTP,please try again",})
    }

  } catch (error) {
    console.error("Error in verifying the otp",error);
    res.status(500).json({success:false,message:"An error occured"})
  }
}


const resendSignupOtp=async(req,res)=>{
  try {
    const {email}=req.session.userData;
    if(!email){
      return res.status(400).json({success:false,message:"Email not found in session"})
    }
    const otp=generateOtp();
    req.session.userOtp=otp;
    const emailSent=await sendVerificationEmail(email,otp);
    if(emailSent){
      console.log("Resend Otp:",otp)
      res.status(200).json({success:true,message:"Otp resend successfully"})

    }else{
      res.status(500).json({success:false,message:"Failed to resend OTP,Please try again"})
    }
  } catch (error) {
    console.error("Error resending OTP",error)
    res.status(500).json({success:false,message:"Internal server error,Please try later"})
  }
}

const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    const user = await userSchmea.findOne({ email }).select("+password");

    if (!user || !user.password) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/login");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    

    if (!isMatch) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/login");
    }

    req.session.user = true;
    res.redirect("/")
  } catch (error) {
    console.error("Error in saving user", error);
    res.status(500).send("Internal server error");
  }
};

const loadHomepage = async (req, res) => {
  try {
    return res.render("user/home", { title: "Trenaura-Home page" });
  } catch (error) {
    console.error("Error in rendering home page:", error);
    res.status(500).send("Server error");
  }
};

const loadLogin = async (req, res) => {
  try {
    return res.render("user/login", {
      title: "Trenaura Login page",
      hideHeader: true,
      hideFooter: true,
      messages: req.flash("error"),
    });
  } catch (error) {
    console.error("Error in rendering login page:", error);
    res.status(500).send("Server error");
  }
};

const pageNotFound = async (req, res) => {
  try {
    res.render("user/page-404", {
      title: "Trenaura-Page not found",
      hideHeader: true,
      hideFooter: true,
    });
  } catch (error) {
    res.redirect("/pageNotfound");
  }
};

const loadSignup = async (req, res) => {
  try {
    return res.render("user/signup", {
      title: "Trenaura Signup page",
      hideHeader: true,
      hideFooter: true,
      message: req.query.message,
    });
  } catch (error) {
    console.error("Error in rendering signup page:", error);
    res.status(500).send("Server error");
  }
};


const veryfyOtp= async(req,res)=>{
  try {
    return res.render("user/veryfyOtp", {
      title: "Trenaura veryfyOtp page",
      hideHeader: true,
      hideFooter: true,
    });
  } catch (error) {
    
  }
}

module.exports = {
  loadHomepage,
  pageNotFound,
  loadLogin,
  loadSignup,
  signup,
  login,
  veryfyOtp,
  veryfySignupOtp,
  resendSignupOtp,

};

const user=require('../models/userSchema')


const checkSession = (req, res, next) => {
  if (req.session.isLoggedIn) {
    next();
  } else {
    res.redirect("/login");
  }
};

const isLoggedIn=(req,res,next)=>{
    if(req.session.isLoggedIn){
        res.redirect('/')
    }else{
        next()
    }
}

const userAuth=(req,res,next)=>{
  if(req.session.user){
    user.findById(req.session.user)
    .then(data=>{
      if(data && !data.isBlocked && !data.isAdmin){
        next()
      }else{
        res.redirect('/login')
      }
    }).catch(error=>{
      console.log("Error in user auth middleware",error)
      res.redirect("/pageNotfound");
    })
  }else{
    res.redirect('/login')
  }
}


const adminAuth=(req,res,next)=>{
  user.findOne({isAdmin:true})
  .then(data=>{
    if(data){
      next()
    }else{
      res.redirect('admin/login')
    }
  })
  .catch(error=>{
    console.log("Error in admin auth middleware",error)
      res.redirect("/pageNotfound");
  })

}





module.exports ={
    checkSession,
    isLoggedIn,
    adminAuth,
    userAuth,
}
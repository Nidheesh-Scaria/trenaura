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

module.exports ={
    checkSession,
    isLoggedIn
}
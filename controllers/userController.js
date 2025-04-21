
const loadHomepage=async (req,res)=>{
    try {
       return res.render('user/home',{title:"Trenaura-Home page"})
    } catch (error) {
        console.error("Error in rendering home page:", error);
        res.status(500).send("Server error")
    }
}


const loadLogin=async(req,res)=>{
    try {
        return res.render('user/login',{title:"Trenaura  page",hideHeader: true,hideFooter: true})
    } catch (error) {
        console.error("Error in rendering login page:", error);
        res.status(500).send("Server error")
    }
}

const pageNotFound=async(req,res)=>{
    try {
        res.render('user/page-404',{title:"Trenaura-Page not found", hideHeader: true,hideFooter: true})
    } catch (error) {
        res.redirect("/pageNotfound")
    }
}

module.exports={
    loadHomepage,pageNotFound,loadLogin
}
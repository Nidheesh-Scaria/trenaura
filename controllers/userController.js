




const loadHomepage=async (req,res)=>{
    try {
       return res.render('user/home')
    } catch (error) {
        console.error("Error in rendering home page:", error);
        res.status(500).send("Server error")
    }
}


module.exports={
    loadHomepage,
}
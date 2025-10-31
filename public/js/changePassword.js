const form=document.getElementById('changePasswordForm')
const errorMessage=document.getElementById('errorMessage')

form.addEventListener('submit',async(e)=>{
    e.preventDefault();
    errorMessage.textContent=''

    const formData={
        currentPassword:document.getElementById('currentPassword').value,
        newPassword:document.getElementById('newPassword').value,
        confirmPassword:document.getElementById("confirmPassword").value
    }

     const res = await fetch('/handleChangePassword', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });

    const data=await res.json()
    console.log(data.message)
    if(res.ok){
        Toastify({
            text: data.message,
            duration: 3000,
            destination: "https://github.com/apvarun/toastify-js",
            newWindow: true,
            close: true,
            gravity: "top", // `top` or `bottom`
            position: "center", // `left`, `center` or `right`
            stopOnFocus: true, // Prevents dismissing of toast on hover
            style: {
                background: "linear-gradient(to right, #261f79e7, #13438cf7)",
            },
            onClick: function(){} // Callback after click
            }).showToast();

            form.reset();

    }else{
         errorMessage.textContent=data.message||"Error in changing"

    }
})
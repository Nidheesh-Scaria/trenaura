const mongoose = require("mongoose");
const { Schema } = mongoose;


const coupponSchema= new Schema({
    name:{
        type: String,
        required: true,
        unique:true,
    },
    createdAt:{
        type: Date,
        default:Date.now,
        required: true,
    },
    expireOn:{
        type: Date,
        required: true,
    },
    offerProce:{
        type: Number,
        required: true,
    },
    minimumPrice:{
        type: Number,
        required: true,
    },
    isList:{
        type: Boolean,
        default:true,
    },
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },


})

const Couppon= mongoose.model("Couppon",coupponSchema)

module.exports=Couppon
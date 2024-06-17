require('dotenv').config();
const { log, error } = require('console');
const express = require('express');
const path = require('path');
const cron=require('node-cron');
const fetch=require('node-fetch');
const app = express();
const pg = require("pg");
const postgres=require('postgres');
const port = process.env.port || 8000;
let stoke = [];
let bills = []
let gstRate = 18;
let print=[];
let orignalgst=[];
let orignalmobile=[];
let orignalbaseprice=[]
const db = new pg.Client({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

db.connect();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');


app.set('views', path.join(__dirname, 'views'));


app.use(express.urlencoded({ extended: true }));

async function keepAlive() {
  try {
    const response = await fetch('https://bhatitraders.onrender.com/ping');
    if (response.ok) {
      console.log('Server is alive:', new Date());
    } else {
      console.log('Server returned an error:', response.status, new Date());
    }
  } catch (error) {
    console.error('Error making request:', error, new Date());
  }
}

// Schedule the keep-alive function to run every 14 minutes
cron.schedule('*/14 * * * *', () => {
  console.log('Running keepAlive task:', new Date());
  keepAlive();
});

// Initial call to keep the server alive immediately when the server starts
keepAlive();

async function stokeupdate(data) {
  try {

    await db.query("INSERT INTO STOKE (mobilebrand, mobilename,varient,color) VALUES($1,$2,$3,$4)",
      [data.Mobilebrand, data.mobilename, data.varient, data.Color]
    );
    console.log("data is inserted");

  } catch (error) {
    console.log(error);
  }
};




async function mobile(d){
  let str;
  if (d.device) {
    const data = d.device.split(",");
    str = {
      brandname: data[0]?.trim() || '',
      model: data[1]?.trim() || '',
      varient: data[2]?.trim() || '',
      color: data[3]?.trim() || ''
    };
    return str
  }
  else{
    console.log(error);
    return  error
  }


}

// for gst calculation

async function calculateBasePrice(totalPrice, gstRate) {
  let basePrice = totalPrice / (1 + (gstRate / 100));
  return basePrice;
}



async function calculateGSTComponents(basePrice, gstRate) {
  let cgstRate = gstRate / 2;
  let sgstRate = gstRate / 2;
  let igstRate = gstRate;
  let cgst = (basePrice * cgstRate) / 100;
  let sgst = (basePrice * sgstRate) / 100;
  let igst = (basePrice * igstRate) / 100;

  return {
    basePrice: basePrice,
    cgst: cgst,
    sgst: sgst,
    igst: igst,
    totalWithinState: basePrice + cgst + sgst,
    totalInterState: basePrice + igst
  };
}


async function stockchecklist(id) {
  stoke=[]
  // console.log(id);
  try {
    db.query("DELETE FROM stoke WHERE id=$1", [id]).then(() => {
      const newarr = stoke.filter((i) => i.mobileid !== id);
      stoke = newarr;
      console.log("deleted susessfully")
    });

  } catch (error) {

  }

}


async function renderdata() {

  stoke=[]
  const data = await db.query("SELECT * FROM stoke ORDER BY id DESC");
  if (data !== null) {
    if (stoke.length == 0) {

      data.rows.forEach((items) => {
        stoke.push(items)
      });
    } else {
      console.log("stocks items pushed already");
    }
  }
  // console.log(stoke);
  return stoke;
};


async function renderbills() {
  const data = await db.query("SELECT id ,customername,address,mobileno,imei,amount,billdate,mobileid,device FROM bills  ORDER BY id DESC")
  if (data !== null) {

    const customer = data.rows;
    // console.log(customer);
  
    const formattedCustomers = customer.map(customer => {
      return {
        id: customer.id,
        customername: (customer.customername!==null)? customer.customername.trim():customer.customername,
        address:(customer.address!==null)? customer.address.trim():customer.address,
        mobileno: customer.mobileno,
        imei: (customer.imei!==null)? customer.imei.trim():customer.imei,
        amount: customer.amount,
        billdate: customer.billdate, // Formatting the date to a readable format
        mobileid: customer.mobileid,
        device: customer.device
      };

    });
    if (bills.length == 0) {
      formattedCustomers.forEach((items) => {
        bills.push(items);
      });
    } else {
      console.log("bills items pushed already");
    }
  }

  return bills
}

app.get("/", async (req, res) => {
  const data = await renderdata();

  res.render('billpage.ejs');


});

app.get("/suggest", async (req, res) => {
  const SELECT = req.query.q;
  const data1 = await renderdata();
  //   console.log(stoke);
  // console.log(SELECT);
  const data = data1.filter((select) =>
    (select.mobilebrand.trim().toLowerCase().includes(SELECT)) || select.mobilename.trim().toLowerCase().includes(SELECT));
  //   console.log(data);
  res.json(data);
});

app.get("/update/:test", async (req, res) => {
  const str = req.params.test;
  const id = +str;
  try {
    const bills = await renderbills();
    console.log(typeof (id));
    // console.log(bills);

    const data = bills.find(item => item.id === id);
    if (data) {
      res.render('updatebill.ejs', { data: data, action: "update", btn: "btn-success", id: "update" });

    } else {
      res.redirect("/bills")
    }
  } catch (error) {

    console.log(error);
  }

});
app.get("/delete/:test", async (req, res) => {
  const str = req.params.test;
  const id = +str;
  try {
    const bills = await renderbills();
    // console.log(typeof(id));
    // console.log(bills);

    const data = bills.find(item => item.id === id);
    if (data) {
      res.render('updatebill.ejs', { data: data, action: "Delete", btn: "btn-danger", id: "delete" });

    } else {
      res.redirect("/bills")
    }
  } catch (error) {

    console.log(error);
  }

});

app.post("/update", (req, res) => {
  const data = req.body;
  // console.log(data);

  db.query("UPDATE bills SET Customername=$1, address=$2,mobileno=$3,amount=$4,billdate=$5 WHERE id=$6",
    [data.customername, data.address, data.mobileno, data.amount, data.date, data.customerid]);
  bills = []
  res.redirect("/bills")
})

app.post("/Delete", async (req, res) => {
  const data = req.body;
  // console.log(data);
  try {
    bills = []
    await db.query("DELETE FROM bills WHERE id=$1",
      [data.customerid]).then(() => console.log("deleted sucessfully"));
  const data1 = await renderdata();

    res.redirect("/bills");
  } catch (error) {
    console.log(error);
    res.redirect("/bills");

  }

})
app.get("/bills", async (req, res) => {
  bills = []
  const data = await renderbills();
  res.render('update.ejs', { data ,total:data.length});
});

app.get("/stockupdate", (req, res) => {
  res.render("stoke.ejs")

});

app.post("/stockinsert", async (req, res) => {
  try {
    const data = req.body;
    // console.log(data);
    stoke = []
    await stokeupdate(data)
    res.redirect("/")
  } catch (error) {
    res.redirect("/bills")
  }
})

app.get("/billupload",async(req,res)=>{

  res.render("fullbillpage.ejs",{d:print,gst:orignalgst,mobile:orignalmobile,baseprice:orignalbaseprice});

  
})

app.post("/billupload", async (req, res) => {

  // console.log(req.body);
  try {
    const data = req.body
    await db.query("INSERT INTO Bills (CustomerName,address,MobileNo,imei,amount,billdate,mobileid,device ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [data.customername, data.address, data.mobileno, data.imei, data.amount, data.date, data.mobileid, data.device]
    ).then(() => { stockchecklist(data.mobileid); });

  const onebill = await db.query("SELECT id ,customername,address,mobileno,imei,amount,billdate,mobileid,device FROM bills WHERE mobileid=$1",[data.mobileid])
        const bill=onebill.rows;
    //  console.log(bill);

print=bill[0];
const data1=await mobile(print)

      
      let basePrice = await calculateBasePrice(data.amount, gstRate);
  let gst = await calculateGSTComponents(basePrice, gstRate);
orignalgst=gst;
orignalbaseprice=basePrice;

    res.render("fullbillpage.ejs",{d:print,gst:gst,baseprice:basePrice,mobile:data1});
  } catch (error) {
    console.log(error);
  }
});


app.get("/billopen/:test",async(req,res)=>{

  
  // console.log(id);
  try {
    const str = req.params.test;
  const id = parseInt(str, 10);
    const bills= await renderbills();
    const bill=bills.find((i)=>i.id===id);
    // console.log(bill);
      print=bill;
      // console.log(bill);
      // console.log(print);
      const data=await mobile(bill);
      //  console.log(data);
      // let amount=10000;
      let basePrice = await calculateBasePrice(bill.amount, gstRate);
    let gst = await calculateGSTComponents(basePrice, gstRate);
      
orignalgst=gst;
orignalbaseprice=basePrice;

        orignalmobile=data;;
        // console.log(mobile);
      res.render("printbill.ejs",{d:bill,gst:gst,baseprice:basePrice,mobile:data});
    // res.redirect('/bills')
    // console.log(billstyle);
  } catch (error) {
    console.log(error);
    res.redirect('/bills')

  }
})

app.get("/search",(req,res)=>{

  res.render('search.ejs')
});


app.get("/search/:test",(req,res)=>{
let total='';
let total2='';
let data=[]
let data1=[]

  if(req.params.test==='bills'){

   
    res.render('searchpage.ejs',{word:true,w:'bills',value:"Enter bills details",total,data});
    // console.log("bills");
  }
  if(req.params.test==='mobiles'){

    // console.log('mobiless');
    res.render('searchpage.ejs',{word:false,w:'stock',value:"enter mobile details",total2,data1});

  }
})


app.get("/supdate/:test",async(req,res)=>{

  try {
    const str = req.params.test;
    const id = parseInt(str, 10);
    const stock= await renderdata();
    const data = stock.find(item => item.id === id);
    if (data) {
      res.render('stocksviewpage', { data: data, action: "update", btn: "btn-success"});

    } else {
      res.redirect("/allstock")
    }
      
  } catch (error) {
     console.log(error);
     res.redirect("/")
  }


})
app.get("/sdelete/:test",async(req,res)=>{
  try {
    const str = req.params.test;
    const id = parseInt(str, 10);
    const stock= await renderdata();
    const data = stock.find(item => item.id === id);
    if (data) {
      res.render('stocksviewpage', { data: data, action: "delete", btn: "btn-danger"});

    } else {
      res.redirect("/allstock")
    }
      
  } catch (error) {
     console.log(error);
     res.redirect("/")
  }


})

app.post("/s/:t",async(req,res)=>{
  try {
    if(req.params.t==="update"){
      const data = req.body;
      console.log(data);
      // console.log(data);
    
      db.query("UPDATE stoke SET mobilebrand=$1, mobilename=$2,varient=$3,color=$4 WHERE id=$5",
        [data.mobilebrand, data.mobilename, data.varient, data.color, data.id]);
      stoke = []
      res.redirect("/allstock");

    }
    
    if(req.params.t==="delete"){
      const data = req.body;
  // console.log(data);
 
    stoke = []
    await db.query("DELETE FROM stoke WHERE id=$1",
      [data.id]).then(() => console.log("deleted sucessfully"));
  const data1 = await renderdata();

    res.redirect("/allstock");
 
  
    }
  } catch (error) {
    res.redirect("/");
  }
 

})



app.get("/allstock",async (req,res)=>{
const data= await renderdata();
// console.log(data.length);
res.render("allstoke.ejs",{data,total:data.length});

});

app.post("/search/:t",async(req,res)=>{

  try {

if(req.params.t==='bills'){
   const search=req.body.searchedtext;
  //  console.log(search);

   const final =await db.query("SELECT * FROM bills WHERE LOWER(customername)||LOWER(mobileno)||LOWER(imei) LIKE '%' || $1 || '%'; ",[search.toLowerCase()]);
 const data=final.rows;
 res.render("searchpage.ejs",{word:true,w:'bills',value:'',data:data,total:data.length});



}

if(req.params.t==='stock'){

  const search=req.body.searchedtext;
  // console.log(search);

  const final =await db.query("SELECT * FROM stoke WHERE LOWER(mobilebrand)||LOWER(mobilename)||LOWER(varient)||LOWER(color) LIKE '%' || $1 || '%'; ",[search.toLowerCase()]);
 const data=final.rows;


 res.render("searchpage.ejs",{word:false,w:'stock',value:'',data1:data,total2:data.length});


};


    
  } catch (error) {
    res.redirect('/search/stock')
  }


})



app.listen(port, () => {
  console.log("server is started sucessfully");
})


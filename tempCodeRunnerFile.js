app.get('/user_login', function (req, res) {
    const success = req.query.success || null;
    let alertScript = '';

    if (success) {
        alertScript = '<script>alert("สมัครบัญชีสำเร็จ");</script>';
    } 
    res.render('user/user_login', { success: success, alertScript: alertScript  });
});
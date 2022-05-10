const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("multiSigWallet", function () {
    let [owner1, owner2, owner3, owner4, owner5, submiter] = []
    let multiSigWallet
    let amount = ethers.utils.parseEther("10")    
    let address0 = "0x0000000000000000000000000000000000000000"
    beforeEach(async () => {
        [owner1, owner2, owner3, owner4, owner5, submiter] = await ethers.getSigners();
        const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
        multiSigWallet = await MultiSigWallet.deploy([owner1.address, owner2.address, owner3.address, owner4.address, owner5.address], 3)
        await multiSigWallet.deployed()  
        await owner1.sendTransaction({
            to: multiSigWallet.address,
            value: ethers.utils.parseEther("10")
            });
    })

    describe("submit", function () {
        it("should revert if the caller is not owner", async function () {
            await expect(multiSigWallet.connect(submiter).submit(submiter.address, amount, "0x74657374000000000000000000000000000000000000000000000000000000")).to.be.revertedWith("Not owner")
        });
        it("should submit correctly", async function () {
            const submitTx = await multiSigWallet.connect(owner1).submit(submiter.address, amount, "0x74657374000000000000000000000000000000000000000000000000000000")
            await expect(submitTx).to.be.emit(multiSigWallet, "Submit").withArgs(0, submiter.address, amount, "0x74657374000000000000000000000000000000000000000000000000000000")
        });
    })
    describe("approve", function () {
        beforeEach(async () => {
            await multiSigWallet.connect(owner1).submit(submiter.address, amount, "0x74657374000000000000000000000000000000000000000000000000000000")
            await multiSigWallet.connect(owner2).submit(submiter.address, amount, "0x74657374000000000000000000000000000000000000000000000000000000")           
        })
        it("should revert if the caller is not owner", async function () {
            await expect(multiSigWallet.connect(submiter).approve(0)).to.be.revertedWith("Not owner")
        });
        it("should revert if txId not exist", async function () {
            await expect(multiSigWallet.connect(owner1).approve(2)).to.be.revertedWith("txId not exist")
        });
        it("should revert if txId is aldready approved", async function () {
            await multiSigWallet.connect(owner1).approve(0)
            await expect(multiSigWallet.connect(owner1).approve(0)).to.be.revertedWith("txId aldready approved")
        });
        it("should revert if txId is aldready approved", async function () {
            await multiSigWallet.connect(owner1).approve(0)
            await multiSigWallet.connect(owner2).approve(0)
            await multiSigWallet.connect(owner3).approve(0)            
            await multiSigWallet.connect(owner1).execute(0)
            await expect(multiSigWallet.connect(owner4).approve(0)).to.be.revertedWith("txId aldready executed")
        });
        it("should aprrove correctly", async function () {
            const aprroveT1 = await multiSigWallet.connect(owner1).approve(0)
            expect(await multiSigWallet.approved(0, owner1.address)).to.be.equal(true)
            expect(await multiSigWallet.approvalCount(0)).to.be.equal(1)
            await expect(aprroveT1).to.be.emit(multiSigWallet, "Aprrove").withArgs(owner1.address, 0)

            const aprroveT2 = await multiSigWallet.connect(owner2).approve(0)
            expect(await multiSigWallet.approved(0, owner2.address)).to.be.equal(true)
            expect(await multiSigWallet.approvalCount(0)).to.be.equal(2)
            await expect(aprroveT2).to.be.emit(multiSigWallet, "Aprrove").withArgs(owner2.address, 0)

            const aprroveT3 = await multiSigWallet.connect(owner3).approve(0)       
            expect(await multiSigWallet.approved(0, owner3.address)).to.be.equal(true)
            expect(await multiSigWallet.approvalCount(0)).to.be.equal(3) 
            await expect(aprroveT3).to.be.emit(multiSigWallet, "Aprrove").withArgs(owner3.address, 0) 
        });        
    })
        
    describe("revoke", function () {
        beforeEach(async () => {
            await multiSigWallet.connect(owner1).submit(submiter.address, amount, "0x74657374000000000000000000000000000000000000000000000000000000")
            await multiSigWallet.connect(owner2).submit(submiter.address, amount, "0x74657374000000000000000000000000000000000000000000000000000000")
        })
        it("should revert if tx is not approved yet", async function () {
            await expect(multiSigWallet.connect(owner1).revoke(0)).to.be.revertedWith("tx not approved yet")
        });
        it("should revoke correctly", async function () {
            await multiSigWallet.connect(owner1).approve(0)
            const RevokeT1 = await multiSigWallet.connect(owner1).revoke(0)
            expect(await multiSigWallet.approved(0, owner1.address)).to.be.equal(false)
            expect(await multiSigWallet.approvalCount(0)).to.be.equal(0)
            await expect(RevokeT1).to.be.emit(multiSigWallet, "Revoke").withArgs(owner1.address, 0)
        });        
    })

    describe("execute", function () {
        beforeEach(async () => {
            await multiSigWallet.connect(owner1).submit(submiter.address, amount, "0x74657374000000000000000000000000000000000000000000000000000000")
            await multiSigWallet.connect(owner2).submit(submiter.address, amount, "0x74657374000000000000000000000000000000000000000000000000000000")
            await multiSigWallet.connect(owner1).approve(0)
            await multiSigWallet.connect(owner2).approve(0)
            await multiSigWallet.connect(owner3).approve(0)  
        })
        it("should revert if not enough approval", async function () {
            await multiSigWallet.connect(owner3).revoke(0)
            await expect(multiSigWallet.connect(owner1).execute(0)).to.be.revertedWith("Number of approvals is less than required")
        });
        it("should execute correctly", async function () {
            const executeTx = await multiSigWallet.connect(owner1).execute(0)
            await expect(executeTx).to.be.emit(multiSigWallet, "Execute").withArgs(0, submiter.address, amount, "0x74657374000000000000000000000000000000000000000000000000000000")
            const transactionTx = await multiSigWallet.transactions(0)
            expect(transactionTx.executed).to.be.equal(true)
            expect(await multiSigWallet.getBalance()).to.be.equal(0)            
        });      
    })
})
